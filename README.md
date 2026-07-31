# FrostRoute

냉장 물류 차량의 위치와 온도 텔레메트리를 MQTT로 수집하고 TimescaleDB에
저장해 관제하는 개인 미니 프로젝트입니다.

현재는 구현 전 설계와 협업 기준선을 확정한 상태입니다.

## 예정 아키텍처

```text
Vehicle Simulator
       │ MQTT v5 / QoS 1
       ▼
Mosquitto Broker
       │
       ▼
Telemetry Ingestor ──────▶ TimescaleDB
                                  ▲
Browser ─▶ Reverse Proxy ─▶ Next.js Web
                  └──────▶ NestJS API ──┘
```

전체 코드는 하나의 pnpm 모노레포에서 관리하지만 simulator, ingestor, API,
web은 각각 독립 실행·배포 가능한 애플리케이션으로 유지합니다.

## 예정 기술

- TypeScript와 pnpm workspace
- Next.js
- NestJS 기본 Express adapter
- MQTT.js와 Eclipse Mosquitto
- TimescaleDB/PostgreSQL
- Docker Compose
- Terraform
- NAVER Maps Web Dynamic Map

## 문서

- [기능 계획](docs/01-plan/features/cold-chain-fleet-monitoring.plan.md)
- [기술 설계 색인](docs/02-design/features/cold-chain-fleet-monitoring.design.md)
  - [00 공통 설계](docs/02-design/features/cold-chain-fleet-monitoring/00-common.design.md)
  - [01 차량 에뮬레이터](docs/02-design/features/cold-chain-fleet-monitoring/01-vehicle-simulator.design.md)
  - [02 텔레메트리 수집](docs/02-design/features/cold-chain-fleet-monitoring/02-telemetry-ingestion.design.md)
  - [03 차량 관리](docs/02-design/features/cold-chain-fleet-monitoring/03-vehicle-management.design.md)
  - [04 이상 이벤트](docs/02-design/features/cold-chain-fleet-monitoring/04-event-monitoring.design.md)
  - [05 관제 화면](docs/02-design/features/cold-chain-fleet-monitoring/05-monitoring-dashboard.design.md)
  - [06 배포 기반](docs/02-design/features/cold-chain-fleet-monitoring/06-deployment.design.md)
  - [07 관리자 인증](docs/02-design/features/cold-chain-fleet-monitoring/07-admin-authentication.design.md)
- [개발 컨벤션](docs/01-plan/convention.md)
- [2인 협업 정책](docs/01-plan/team-workflow.md)
- [macOS·Windows Git 설정](docs/development/git-setup.md)

## 현재 상태

```text
[Plan] 완료 -> [Design] 완료 -> [Do] 진행
```

다음 구현 단계는 pnpm 모노레포와 로컬 인프라 구성입니다.
