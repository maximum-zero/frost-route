# 텔레메트리 수집 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 관련 요구사항: FR-02~FR-06
> 문서 순서: 02 | 공통 기준: [공통 설계](00-common.design.md)

## 1. MQTT 계약

토픽:

```text
fleet/{vehicleId}/telemetry
```

- protocol: MQTT 5
- QoS: 1
- retained message: 미사용
- subscriber filter: `fleet/+/telemetry`
- `vehicleId`: `VH-` 뒤 3~6자리 숫자

payload:

```json
{
  "schemaVersion": 1,
  "messageId": "65e76b44-05e2-4f66-9133-9203fa51369e",
  "vehicleId": "VH-001",
  "sessionId": "e06829f4-f031-4e17-8106-b06721cc962c",
  "sequence": 10452,
  "recordedAt": "2026-07-31T10:20:30.123Z",
  "location": {
    "latitude": 37.5665,
    "longitude": 126.978
  },
  "speedKph": 52.4,
  "heading": 128,
  "cargo": {
    "temperatureC": -17.8,
    "doorOpen": false
  }
}
```

검증:

| 필드 | 규칙 |
|---|---|
| `schemaVersion` | `1` |
| `messageId` | UUID |
| `vehicleId` | 토픽 ID와 일치 |
| `sessionId` | UUID |
| `sequence` | 0 이상의 정수 |
| `recordedAt` | UTC ISO 8601, 과거 24시간~미래 5분 |
| `latitude` | -90~90 |
| `longitude` | -180~180 |
| `speedKph` | 0~200 |
| `heading` | 0 이상 360 미만 |
| `temperatureC` | -50~50 |

## 2. 처리 흐름

```text
MQTT 수신
 -> receivedAt 기록
 -> topic·payload 검증
 -> 활성 차량 조회
 -> ingested_messages 접수
 -> vehicle_telemetry 저장
 -> 최신 상태 조건부 갱신
 -> 이벤트 평가
 -> transaction commit
 -> MQTT ACK
```

MQTT.js의 MQTT v5 `customHandleAcks`를 사용해 DB transaction 성공 전에는
PUBACK를 완료하지 않는다. 구현 첫 통합 테스트에서 이 동작을 검증한다. 원하는
보장이 나오지 않으면 bounded local inbox table을 대안으로 사용한다.

## 3. `ingested_messages`

일반 PostgreSQL 테이블이며 telemetry 본문을 저장하지 않는다.

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `message_id` | uuid | PK |
| `vehicle_id` | uuid | FK, NOT NULL |
| `session_id` | uuid | NOT NULL |
| `sequence` | bigint | NOT NULL |
| `recorded_at` | timestamptz | NOT NULL |
| `received_at` | timestamptz | NOT NULL |

- UNIQUE: `(vehicle_id, session_id, sequence)`
- `received_at` 기준 48시간이 지난 접수 기록 cleanup
- 접수 충돌 시 중복으로 정상 종료

과거 메시지는 현재 기준 24시간까지만 허용하므로 접수 기록 보존 기간을 더 길게
유지한다. cleanup과 검증 경계의 경쟁을 피하고 telemetry 유일성 제약을 마지막
방어선으로 사용한다.

## 4. `vehicle_telemetry`

TimescaleDB hypertable:

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `recorded_at` | timestamptz | NOT NULL, hypertable time |
| `received_at` | timestamptz | NOT NULL |
| `message_id` | uuid | NOT NULL |
| `vehicle_id` | uuid | FK, NOT NULL |
| `session_id` | uuid | NOT NULL |
| `sequence` | bigint | NOT NULL |
| `latitude` | double precision | NOT NULL |
| `longitude` | double precision | NOT NULL |
| `speed_kph` | numeric(6,2) | NOT NULL |
| `heading` | numeric(6,2) | NOT NULL |
| `temperature_c` | numeric(5,2) | NOT NULL |
| `door_open` | boolean | NOT NULL |

- partition time: `recorded_at`
- chunk interval: 1일
- index: `(vehicle_id, recorded_at DESC)`
- unique: `(recorded_at, message_id)`
- MVP retention·compression 미적용

TimescaleDB hypertable의 unique index는 partition time인 `recorded_at`을 포함한다.

## 5. `vehicle_latest_states`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `vehicle_id` | uuid | PK, FK |
| `recorded_at` | timestamptz | 최신 측정 시각 |
| `received_at` | timestamptz | 최신 측정값의 서버 수신 시각 |
| `session_id` | uuid | 최신 세션 |
| `sequence` | bigint | 최신 sequence |
| `latitude`, `longitude` | double precision | 최신 위치 |
| `speed_kph` | numeric(6,2) | 최신 속도 |
| `temperature_c` | numeric(5,2) | 최신 온도 |
| `door_open` | boolean | 문 상태 |
| `connection_status` | varchar(16) | ONLINE·OFFLINE |
| `temperature_status` | varchar(16) | NORMAL·ALERT |
| `last_live_received_at` | timestamptz | 마지막 유효 실시간 수신 시각 |
| `updated_at` | timestamptz | 갱신 시각 |

- `recordedAt`이 기존 값보다 새로운 경우에만 측정 상태 갱신
- `abs(receivedAt - recordedAt) > 5초`이면 이력만 저장
- 지연 데이터의 최신 상태·실시간 온도 경보 갱신 금지
- `abs(receivedAt - recordedAt) <= 5초`인 유효 메시지는 측정값 갱신 여부와 무관하게
  `last_live_received_at = GREATEST(기존 값, receivedAt)`으로 갱신
- 통신 상태는 `last_live_received_at`으로 판단
- 지연 데이터만 재전송한 경우 ONLINE 복구 금지

## 6. 트랜잭션

1. 차량 코드와 활성 상태 확인
2. `ingested_messages` insert
3. 접수 충돌 시 중복으로 종료
4. telemetry insert
5. 실시간·최신 데이터인 경우 latest state upsert
6. 유효 실시간 데이터인 경우 last live received time 갱신
7. 온도 이벤트 상태 평가
8. commit 후 MQTT ACK

실패 시 전체 transaction을 rollback한다.

## 7. 지표

- `messagesReceived`
- `messagesStored`
- `messagesDuplicated`
- `messagesRejected`
- `storageFailures`
- `processingLatencyMs` p50·p95

## 8. 장애 처리

| 장애 | 동작 |
|---|---|
| 잘못된 payload | 저장 거부와 reason code 로그 |
| 미등록·비활성 차량 | 저장 거부 |
| 중복 메시지 | 정상 멱등 종료와 counter 증가 |
| 순서 역전 | 이력 저장, 최신 상태 미갱신 |
| DB 장애 | transaction rollback, ACK 미완료 |
| MQTT 단절 | exponential backoff 재연결 |

## 9. 테스트

- payload 경계값과 필수 필드 검증
- 과거 24시간·미래 5분 recordedAt 경계 검증
- 미래 시각이 허용 범위 안이어도 5초를 넘으면 최신 상태 미갱신
- 토픽·payload 차량 ID 불일치
- 정상 telemetry 저장
- QoS 1 중복 멱등 처리
- transaction rollback
- 순서 역전과 지연 데이터
- 순서 역전 실시간 데이터의 연결 시각 갱신과 측정 상태 미갱신
- 지연 backlog만 수신한 차량의 ONLINE 복구 방지
- 접수 기록 cleanup 이후 허용 범위 밖 메시지 거부
- telemetry unique constraint 기반 최종 중복 방지
- DB 저장 전 강제 종료 후 재전달
- 100 msg/s 10분 처리

## 10. 완료 기준

- 정상 메시지 저장 누락 0건
- 의도하지 않은 중복 telemetry 0건
- 지연 데이터의 이력 저장과 최신 상태 보호
- 구조화 로그에서 저장·중복·거부·실패 구분
