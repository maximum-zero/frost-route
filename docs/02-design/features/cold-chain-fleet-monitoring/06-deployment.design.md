# 배포 기반 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 관련 범위: Docker Compose, Terraform, CI
> 문서 순서: 06 | 공통 기준: [공통 설계](00-common.design.md)

## 1. 책임 분리

Terraform:

- 네트워크와 방화벽
- 단일 VM
- 고정 IP와 DNS 연결 지점
- 애플리케이션과 분리된 데이터 볼륨
- 최소 IAM 권한

Docker Compose:

- Mosquitto
- TimescaleDB
- Ingestor
- NestJS API
- Next.js Web
- Caddy reverse proxy

Terraform `remote-exec`를 반복적인 애플리케이션 배포 수단으로 사용하지 않는다.

## 2. 로컬 구성

```text
infrastructure/docker/
├── compose.yml
├── mosquitto/
└── caddy/
```

로컬 service DNS:

```text
MQTT_URL=mqtt://mosquitto:1883
DATABASE_URL=postgresql://...@timescaledb:5432/frost_route
API_INTERNAL_URL=http://api:4000
```

## 3. Terraform 구성

```text
infrastructure/terraform/
└── environments/
    └── dev/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── terraform.tfvars.example
```

초기에는 불필요한 module 분리를 하지 않는다. 반복되는 구성이 확인된 뒤
network와 server module을 추출한다.

Terraform 구현 Issue 시작 전에 다음 값을 확정한다.

- 클라우드 공급자와 region
- VM image와 instance 크기
- DNS·TLS 인증서 관리 주체
- `pg_dump` 백업 저장 위치와 보존 기간
- Mosquitto 계정·ACL·TLS 인증서 주입 방식

이 값은 최초 설계에서 임의로 고정하지 않고 비용과 사용할 계정을 확인한 뒤
Terraform 변수와 ADR에 기록한다.

## 4. 네트워크

| 포트 | 용도 | 정책 |
|---:|---|---|
| 22 | SSH | 개발자 허용 IP만 |
| 80·443 | Web·API | 외부 공개 |
| 8883 | MQTT TLS | 필요한 client만 |
| 1883 | MQTT plain | 외부 비공개 |
| 5432 | PostgreSQL | 외부 비공개 |

외부 배포에서는 Caddy 또는 동등한 reverse proxy로 HTTPS를 종료한다.
운영 환경의 관리자 세션 쿠키는 HTTPS에서만 전달한다.

path routing:

```text
/api/v1/* -> NestJS API
/*         -> Next.js Web
```

브라우저에는 Web과 API를 하나의 origin으로 공개하고 NestJS API의 내부 포트는 외부에
직접 공개하지 않는다. 로컬 개발은 Next.js rewrite 또는 동일한 Caddy 구성을
사용한다.

## 5. 데이터 보호

- DB 데이터의 애플리케이션 생명주기와 분리된 volume 사용
- Terraform 삭제 방지 설정
- 실제 apply 전 `terraform plan`의 volume 변경 확인
- 정기 `pg_dump`의 별도 저장 위치 사용
- `terraform destroy` 실행 전 데이터 보존 확인

## 6. CI

Pull Request:

```text
lint
typecheck
unit test
build
terraform fmt -check
terraform validate
```

MQTT·DB integration test는 Docker 사용이 가능한 CI job에서 수행한다.
애플리케이션 배포와 Terraform apply workflow는 분리한다.

## 7. 검증

- `docker compose config`
- `terraform fmt -check`
- `terraform validate`
- `terraform plan` 수동 검토
- 외부 비공개 포트 확인
- volume 삭제 방지 확인
- secret과 Terraform state Git 비추적 확인
- `PUBLIC_ORIGIN`과 운영 cookie 속성 확인
- credential의 코드·Terraform state 비포함 확인

실제 클라우드 apply는 비용과 계정 준비 확인 후 별도 승인으로 수행한다.

## 8. 완료 기준

- 로컬 Docker Compose 전체 서비스 실행
- Terraform format·validate 통과
- 단일 VM plan 검토
- DB volume 보호
- 외부 포트 최소 공개
