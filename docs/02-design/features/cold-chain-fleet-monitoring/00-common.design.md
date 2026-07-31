# 콜드체인 차량 관제 - 공통 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 상위 색인: [설계 색인](../cold-chain-fleet-monitoring.design.md)
> 문서 순서: 00

## 1. 설계 목표

- 독립 실행 가능한 앱과 명시적인 서비스 경계
- MQTT QoS 1의 중복·지연·재연결 처리
- 계약과 스키마를 통한 앱 간 일관성
- macOS·Windows에서 재현 가능한 개발 환경
- 로컬 우선 구현과 단계적인 클라우드 확장
- RabbitMQ, Redis, Kubernetes 없는 초기 완성

## 2. 기술 결정

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript | 앱과 공용 계약의 타입 공유 |
| 작업 공간 | pnpm workspace | 가벼운 모노레포 관리 |
| 웹 | Next.js App Router | 관제 화면 구현 |
| API | NestJS, 기본 Express adapter | module·DI·Guard 기반의 일관된 서버 구조 |
| MQTT | MQTT.js, Mosquitto | MQTT v5/QoS 1 검증 |
| 데이터베이스 | TimescaleDB/PostgreSQL | 업무 데이터와 시계열 통합 |
| SQL 접근 | Drizzle ORM, node-postgres driver | Drizzle 기본 접근과 Timescale 전용 SQL 지원 |
| 검증 | Zod | MQTT, HTTP, 환경 변수 경계 검증 |
| 차트 | Recharts | 온도·속도 시계열 표시 |
| 지도 | NAVER Maps Web Dynamic Map | 국내 차량 위치와 경로 표시 |
| 로컬 인프라 | Docker Compose | 재현 가능한 브로커·DB 실행 |
| 클라우드 IaC | Terraform | 단일 VM과 데이터 볼륨 구성 |
| 테스트 | Vitest, Testcontainers | 단위·통합 테스트 분리 |

MQTT 브로커와 TimescaleDB의 직접 연동이 핵심 학습 범위다.

## 3. 시스템 아키텍처

```text
Vehicle Simulator
       │ MQTT v5 / QoS 1
       ▼
Mosquitto Broker
       │ subscribe
       ▼
Telemetry Ingestor ──────▶ TimescaleDB
                                  ▲
Browser ─▶ Reverse Proxy ─▶ Next.js Web
                  └──────▶ NestJS API ──┘
```

웹은 REST로 최초 스냅샷과 이력을 조회한다. 최신 상태 자동 갱신에는 polling,
SSE, WebSocket 중 검증된 방식을 사용하며 설계 단계에서 특정 기술로 고정하지
않는다. 선택 결과와 근거는 ADR에 기록한다.

## 4. 서비스 연결

| 출발 | 도착 | 방식 | 계약 |
|---|---|---|---|
| Simulator | Mosquitto | MQTT v5/QoS 1 | telemetry topic과 Zod schema |
| Mosquitto | Ingestor | MQTT v5/QoS 1 | `fleet/+/telemetry` |
| Ingestor | TimescaleDB | PostgreSQL | migration schema |
| API | TimescaleDB | PostgreSQL | repository와 schema |
| Browser | Reverse Proxy | same-origin HTTPS | `/`, `/api/v1` |
| Reverse Proxy | Web·API | HTTP | path routing |
| Browser | API | proxy 경유 HTTP/JSON | 상대 `/api/v1` DTO |

같은 모노레포에 있다는 이유로 `apps/*` 사이의 직접 import를 허용하지 않는다.

## 5. 프로젝트 구조

```text
frost-route/
├── apps/
│   ├── simulator/
│   ├── ingestor/
│   ├── api/
│   └── web/
├── packages/
│   ├── contracts/
│   ├── database/
│   └── config/
├── infrastructure/
│   ├── docker/
│   └── terraform/
└── docs/
```

의존성:

```text
apps/* -> packages/*
packages/database -> packages/contracts
apps/* -X-> apps/*
packages/* -X-> apps/*
```

각 앱은 독립 entrypoint, 환경 변수, Dockerfile, health check를 가진다.

### API module 구조

```text
apps/api/src/
├── auth/
├── vehicles/
├── monitoring/
├── events/
├── database/
└── common/
```

- 기능별 Nest module과 controller·service·repository 경계 사용
- session 인증과 CSRF의 Guard 적용
- audit와 request context의 공통 Interceptor 적용
- MQTT 수집 책임의 API module 편입 금지
- Express platform 객체의 controller 경계 밖 전달 금지
- 공용 Zod 계약을 custom Pipe에서 검증하고 별도 validation 체계 중복 금지
- workspace 공통 Vitest를 사용하고 Nest 기본 Jest 설정 생성 금지
- Drizzle을 기본 DB API로 사용하고 직접 `pg` query는 Timescale 전용 repository로 제한

### 향후 저장소 분리

다음 조건이 생길 때만 별도 저장소 분리를 검토한다.

- 앱별 릴리스 주기나 접근 권한의 차이
- 별도 팀의 독립 소유
- 특정 앱만의 별도 확장·배포 필요
- 공용 package 변경으로 인한 지속적인 배포 결합

분리 시 MQTT topic, HTTP API, DB 소유권을 함께 재검토한다.

## 6. 공통 환경 변수

```text
DATABASE_URL=
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
API_PORT=4000
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=
PUBLIC_ORIGIN=http://localhost:3000
SESSION_COOKIE_NAME=frost_route_session
SESSION_IDLE_TIMEOUT_MINUTES=30
SESSION_ABSOLUTE_TIMEOUT_HOURS=12
SIMULATOR_VEHICLE_COUNT=100
SIMULATOR_INTERVAL_MS=1000
```

- `.env.example`만 커밋
- 브라우저 공개 가능 값만 `NEXT_PUBLIC_` 사용
- 환경 변수는 앱 시작 경계에서 검증
- `SESSION_COOKIE_NAME`은 로컬 기본값이며 운영에서는 `__Host-frost_route_session` 사용

## 7. 오류와 관측 가능성

공통 API 오류:

```json
{
  "error": {
    "code": "INVALID_TIME_RANGE",
    "message": "조회 범위는 최대 24시간입니다.",
    "requestId": "req-123"
  }
}
```

서버 로그 공통 필드:

```text
timestamp, level, service, message, requestId 또는 messageId
```

초기 운영 확인:

- `/health`: 프로세스 실행 여부
- `/ready`: 필수 외부 연결 사용 가능 여부
- 10초 구간의 수신·저장·중복·거부·실패 수
- 처리 지연 p50·p95

Prometheus와 Grafana는 MVP 이후 선택 확장이다.

## 8. 보안

- MQTT 익명 접속 금지
- 계정별 publish·subscribe ACL
- MQTT payload 최대 16KB
- parameter binding 기반 SQL
- credential, DB URL, 전체 민감 payload 로그 금지
- 외부 배포 전 HTTPS와 MQTT TLS 적용
- 1883과 5432 포트 외부 공개 금지
- 관리자 비밀번호의 Argon2id 해시 저장
- CSPRNG 256bit opaque session token과 SHA-256 hash 저장
- 운영 세션 쿠키의 `HttpOnly`, `Secure`, `SameSite=Lax` 적용
- 동일 origin API와 정확한 `PUBLIC_ORIGIN` 검증
- credential을 포함한 cross-origin API 호출 비허용
- 상태 변경 요청의 Origin·Fetch Metadata·CSRF token 검증
- 로그인 시도 제한과 동일한 실패 응답으로 계정 추측 방지
- credential, 원문 비밀번호, session token 로그 출력 금지

## 9. RabbitMQ 기준

MVP에는 RabbitMQ를 사용하지 않는다. 다음 요구가 실제 발생하면 별도 PDCA 기능으로 도입한다.

- 알림·통계·외부 연동 consumer의 독립 처리
- 업무 처리 실패 retry와 DLQ
- MQTT 수집 완료와 후속 업무 완료 ACK 분리
- 장시간 업무 적체의 MQTT 브로커 분리

도입 위치:

```text
MQTT Broker -> Ingestor -> TimescaleDB
                       └-> RabbitMQ -> Event Workers
```

## 10. 공통 검증

- 앱 간 금지 import 검사
- 환경 변수 누락·오류 검증
- 공통 contract typecheck
- health·readiness 동작
- credential 비노출 검사
- macOS·Windows 공통 명령 실행 가능성
