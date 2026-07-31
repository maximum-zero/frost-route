# 관제 화면 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 관련 요구사항: FR-07, FR-10, FR-13, FR-14, FR-17
> 문서 순서: 05 | 공통 기준: [공통 설계](00-common.design.md)

## 1. 사용자 흐름

1. dashboard의 전체·정상·온도 이상·통신 두절 수 확인
2. 상태별 차량 목록 filter
3. 지도에서 차량 최신 위치 확인
4. 차량 선택 후 상세 화면 이동
5. 시간 범위의 온도·속도·운행 경로 확인

## 2. 관제 API

브라우저는 host와 port를 직접 지정하지 않고 동일 origin의 상대 `/api/v1` 경로를
호출한다. 로컬은 Next.js rewrite, 배포 환경은 reverse proxy가 NestJS API로
전달한다.

| 메서드 | 경로 | 기능 |
|---|---|---|
| `GET` | `/api/v1/monitoring/summary` | 상태별 차량 수 |
| `GET` | `/api/v1/monitoring/vehicles` | 차량별 최신 상태 |
| `GET` | `/api/v1/vehicles/:vehicleId/telemetry` | 시간 범위 이력 |
| `GET` | `/api/v1/vehicles/:vehicleId/telemetry/stats` | 온도·속도 집계 |

telemetry query:

```text
from: UTC ISO 8601, 필수
to: UTC ISO 8601, 필수
limit: 1~5000, 기본 1000
```

- 최대 조회 범위 24시간
- 차량과 시간 기준 `(vehicle_id, recorded_at DESC)` index 사용
- 장시간 집계와 downsampling은 후속 범위

## 3. 대표 응답

```json
{
  "items": [
    {
      "vehicleId": "8a497e4f-b099-4de4-89c8-28c31c5cc531",
      "code": "VH-001",
      "licensePlate": "12가3456",
      "recordedAt": "2026-07-31T10:20:30.123Z",
      "receivedAt": "2026-07-31T10:20:30.281Z",
      "latitude": 37.5665,
      "longitude": 126.978,
      "speedKph": 52.4,
      "temperatureC": -17.8,
      "connectionStatus": "ONLINE",
      "temperatureStatus": "NORMAL"
    }
  ],
  "generatedAt": "2026-07-31T10:20:31.000Z"
}
```

## 4. 웹 경로

| 경로 | 기능 |
|---|---|
| `/login` | 관리자 로그인 |
| `/dashboard` | 요약 카드, 상태 filter, 차량 관제 목록·지도 |
| `/vehicles` | 차량 목록, 등록, 수정 |
| `/vehicles/[vehicleId]` | 최신 상태, 그래프, 경로, 이벤트 |
| `/events` | 이상 이벤트 목록과 확인 |

차량 상세 구성:

- 차량 기본 정보와 관제 활성 상태
- 허용 온도 범위
- 최신 위치·온도·속도·문 상태
- 마지막 측정·수신·유효 실시간 수신 시각
- 온도·속도 그래프와 운행 경로
- 진행 중·해제 이벤트와 확인 상태
- 차량 정보 수정 화면 이동

## 5. 최신 상태 자동 갱신

REST API는 최초 스냅샷, 페이지 이동 후 복구, 이력 조회에 사용한다. 이후 변경분
전달 방식은 polling, SSE, WebSocket을 후보로 두고 기술 검증 후 결정한다.

필수 동작:

- 정상 연결에서 최신 상태의 5초 이내 화면 반영
- 연결 단절 감지와 자동 재연결
- 재연결 후 REST 스냅샷 재조회로 누락·순서 역전 복구
- 중복 변경분 수신 시 동일한 화면 상태 유지
- loading, empty, error, stale 상태와 마지막 성공 시각 표시
- 브라우저 background 상태의 불필요한 갱신 최소화

결정 기준:

- 차량 100대, 초당 100개 메시지와 관리자 2명 기준 측정
- 평균·p95 반영 지연, API 요청량, DB 쿼리량
- 서버 CPU·메모리와 연결 수
- 연결 복구 시간과 구현·운영 복잡도

기술 검증 결과는 ADR에 기록한다. 양방향 차량 명령 요구가 없다면 WebSocket의
추가 복잡도도 선택 비용에 포함한다.

## 6. 네이버 지도

- 지도 SDK 코드는 `apps/web` map component에만 배치
- API는 공급자 중립적인 latitude·longitude 반환
- dashboard의 정상=초록, 온도 이상=빨강, 통신 두절=회색 마커
- 차량 상세의 시간순 telemetry 좌표 Polyline
- 다수 차량 marker clustering
- `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 미설정 시 좌표 placeholder
- 실제 연동 시 네이버 클라우드 허용 도메인 설정

## 7. 테스트

- 관제 요약 집계
- 상태 filter와 pagination
- 시간 범위 최대 24시간 검증
- 최신 상태 5초 이내 반영과 stale 표시
- 연결 단절·재연결 후 REST 스냅샷 정합성 복구
- 선택한 전송 방식의 요청량·지연·자원 사용 측정
- 지도 키 유무에 따른 rendering
- 차량 marker와 경로 좌표 변환
- API 오류·빈 데이터 화면
- keyboard만 사용하는 login·목록·상세·이벤트 확인 흐름
- 색상 외 상태 text·icon과 지도 대체 목록 제공

## 8. 완료 기준

- 100대 최신 상태 목록과 지도 표시
- 정상·온도 이상·통신 두절 요약
- 차량 상세 온도·속도 그래프
- 24시간 이내 운행 경로 표시
- 지도 키 없는 개발·CI 환경의 정상 동작
- 최신 상태 전송 방식의 검증 결과와 ADR
- login form label·오류 안내와 관제 상태의 기본 접근성 확인
