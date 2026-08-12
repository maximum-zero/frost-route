# Database Package

FrostRoute의 PostgreSQL/TimescaleDB schema, SQL migration과 migration runner를 관리한다.
Drizzle schema는 TypeScript repository의 타입 기준이며 TimescaleDB extension과 hypertable은
SQL migration에서 명시적으로 관리한다. PostGIS는 현재 범위에 포함하지 않는다.

## 초기 schema

- `vehicles`: 차량 코드, 표시 정보, 허용 온도, 활성 상태
- `ingested_messages`: MQTT QoS 1 중복 판별용 48시간 접수 이력
- `vehicle_telemetry`: `recorded_at` 기준 1일 chunk TimescaleDB hypertable
- `vehicle_latest_states`: 차량별 최신 측정값과 실시간 수신 상태

최초 migration은 simulator와 동일한 `VH-001`~`VH-100` 차량을 생성한다. 번호판과 이름은
로컬·테스트용 seed이며 실제 운영 정보는 차량 관리 기능에서 교체한다.

## migration 적용

루트 `.env.example`을 복사한 `.env`에서 `POSTGRES_PASSWORD`와 `DATABASE_URL`의 비밀번호를
동일하게 설정한다. Docker 인프라가 준비된 뒤 다음 명령을 실행한다.

```bash
pnpm infra:up
pnpm build
pnpm db:migrate
```

migration runner는 파일명 순서로 각 파일을 하나의 transaction에서 실행한다. 적용된 파일의
SHA-256 checksum을 `frost_route_schema_migrations`에 저장하며 이미 적용한 파일이 변경되면
실패한다. 공유된 migration을 수정하지 말고 schema 변경마다 신규 migration을 추가한다.

## 검증

```bash
pnpm test
pnpm test:integration
```

통합 테스트는 `DATABASE_URL`이 지정된 TimescaleDB에 migration을 적용하고 테이블, 차량 seed,
hypertable, chunk interval과 재실행 방지를 확인한다. 실제 credential이나 connection string을
로그에 출력하지 않는다.
