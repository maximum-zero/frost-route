# 로컬 Docker 인프라

> 버전: 1.0.0 | 작성일: 2026-08-01 | 상태: 승인

차량 에뮬레이터와 텔레메트리 수집기를 구현하기 전에 Mosquitto와 TimescaleDB를
동일한 조건으로 실행하기 위한 로컬 개발 환경이다. 운영 배포 구성이 아니다.

## 구성

| 서비스      | 이미지                              | 컨테이너 포트 | 호스트 기본 포트 |
| ----------- | ----------------------------------- | ------------- | ---------------- |
| Mosquitto   | `eclipse-mosquitto:2.0.22`          | 1883          | 1883             |
| TimescaleDB | `timescale/timescaledb:2.28.3-pg17` | 5432          | 5432             |

호스트 포트는 loopback에만 바인딩된다. 다른 프로젝트와 충돌하면 `.env`의
`MQTT_PORT`, `POSTGRES_PORT`를 변경한다. 컨테이너 사이에서는 서비스 DNS와 기본 포트를
사용한다.

```text
mqtt://mosquitto:1883
postgresql://frost_route:<password>@timescaledb:5432/frost_route
```

## 환경 변수

루트 `.env.example`을 참고해 Git에서 제외되는 `.env`를 생성한다. 예시 비밀번호를 그대로
사용하지 않는다.

```text
COMPOSE_PROJECT_NAME=frost-route
MQTT_PORT=1883
POSTGRES_PORT=5432
POSTGRES_DB=frost_route
POSTGRES_USER=frost_route
POSTGRES_PASSWORD=<local-password>
```

같은 장비에서 여러 checkout을 동시에 실행할 때는 `COMPOSE_PROJECT_NAME`과 호스트 포트를
checkout마다 다르게 지정한다. 실제 volume 이름은 이 project 이름을 접두사로 사용한다.

## 실행

```bash
pnpm infra:config
pnpm infra:up
pnpm infra:ps
```

`infra:up`은 두 서비스의 health check가 통과할 때까지 기다린다.

## 연결 검증

터미널 하나에서 구독자를 실행한다.

```bash
pnpm infra:compose exec mosquitto \
  mosquitto_sub -t frost-route/health -C 1
```

다른 터미널에서 메시지를 발행한다.

```bash
pnpm infra:compose exec mosquitto \
  mosquitto_pub -t frost-route/health -m ok
```

TimescaleDB extension을 확인한다.

```bash
pnpm infra:compose exec timescaledb \
  psql -U frost_route -d frost_route \
  -c "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';"
```

`.env`에서 DB 이름이나 사용자를 바꿨다면 명령의 값도 동일하게 변경한다.

## 로그와 종료

```bash
pnpm infra:logs
pnpm infra:down
```

`infra:down`은 컨테이너와 네트워크만 제거하고 named volume은 보존한다. 데이터 삭제는
복구하기 어려우므로 자동화 script를 제공하지 않는다.

## 보안 경계

- MQTT 익명 접속의 로컬 환경 한정
- MQTT와 PostgreSQL의 `127.0.0.1` 바인딩
- 실제 비밀번호와 `.env`의 Git 비추적
- 운영 환경의 Mosquitto 계정·ACL·TLS 필수
- 운영 환경의 PostgreSQL 포트 외부 비공개
