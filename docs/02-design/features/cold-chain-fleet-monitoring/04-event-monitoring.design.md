# 이상 이벤트 관제 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 관련 요구사항: FR-11, FR-12
> 문서 순서: 04 | 공통 기준: [공통 설계](00-common.design.md)

## 1. 이벤트 종류

- `TEMPERATURE`: 허용 온도 범위 이탈
- `COMMUNICATION`: 활성 차량의 메시지 미수신

한 차량에 같은 종류의 `ACTIVE` 이벤트는 하나만 허용한다.

## 2. 온도 이벤트

```text
NORMAL
  │ 1초 주기에서 3회 연속 범위 이탈
  ▼
ACTIVE
  │ 3회 연속 정상 범위
  ▼
RESOLVED
```

- `abs(receivedAt - recordedAt) <= 5초`인 실시간 데이터만 평가
- 지연 데이터는 이력에 저장하되 실시간 이벤트 미생성
- 차량별 `temperature_min_c`, `temperature_max_c` 사용

## 3. 통신 이벤트

```text
ONLINE
  │ 활성 차량의 30초 이상 메시지 미수신
  ▼
OFFLINE / ACTIVE EVENT
  │ 새 telemetry 수신
  ▼
ONLINE / RESOLVED EVENT
```

- 10초 주기 offline 검사
- 비활성 차량은 `INACTIVE`이며 통신 두절 이벤트 미생성
- 브로커 연결 여부보다 `vehicle_latest_states.last_live_received_at` 기준
- 지연 backlog만 수신한 경우 ONLINE 복구와 통신 이벤트 해제 금지

## 4. `monitoring_events`

| 컬럼              | 타입        | 제약                      |
| ----------------- | ----------- | ------------------------- |
| `id`              | uuid        | PK                        |
| `vehicle_id`      | uuid        | FK, NOT NULL              |
| `type`            | varchar(32) | TEMPERATURE·COMMUNICATION |
| `status`          | varchar(16) | ACTIVE·RESOLVED           |
| `severity`        | varchar(16) | WARNING·CRITICAL          |
| `started_at`      | timestamptz | NOT NULL                  |
| `resolved_at`     | timestamptz | NULL                      |
| `acknowledged_at` | timestamptz | NULL                      |
| `acknowledged_by` | uuid        | `admins.id` FK, NULL      |
| `details`         | jsonb       | NOT NULL                  |
| `created_at`      | timestamptz | NOT NULL                  |
| `updated_at`      | timestamptz | NOT NULL                  |

partial unique index:

```text
(vehicle_id, type) WHERE status = 'ACTIVE'
```

필드 소유권:

- Ingestor: `status`, `severity`, `started_at`, `resolved_at`, `details`
- API: `acknowledged_at`, `acknowledged_by`

## 5. API

| 메서드 | 경로                                  | 기능        |
| ------ | ------------------------------------- | ----------- |
| `GET`  | `/api/v1/events`                      | 이벤트 목록 |
| `GET`  | `/api/v1/events/:eventId`             | 이벤트 상세 |
| `POST` | `/api/v1/events/:eventId/acknowledge` | 확인 처리   |

목록 filter:

```text
vehicleId, type, status, cursor, limit
```

이벤트 조회와 확인 처리는 인증된 관리자만 수행한다. 확인 처리 시 현재 관리자
ID와 확인 시각을 함께 저장한다. 이미 확인한 이벤트의 반복 요청은 기존 확인
정보를 유지하고 성공 응답하는 멱등 동작으로 처리한다. ACTIVE와 RESOLVED 이벤트
모두 확인할 수 있다.

## 6. 테스트

- 온도 범위 3회 초과 발생
- 정상 범위 3회 복귀 해제
- 지연 데이터의 이벤트 미생성
- 30초 무수신 통신 이벤트
- 재수신 통신 이벤트 해제
- 비활성 차량 이벤트 미생성
- 동일 ACTIVE 이벤트 중복 방지
- 확인 처리와 Ingestor 상태 변경 충돌 방지
- 확인 관리자와 확인 시각 감사 추적
- 반복 확인 요청의 멱등 처리

## 7. 완료 기준

- 온도 이상과 통신 두절의 발생·해제
- 차량·종류·상태별 이벤트 조회
- 이벤트 확인 처리
- 같은 차량·종류의 중복 ACTIVE 이벤트 0건
