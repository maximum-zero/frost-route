# FrostRoute

> MQTT와 TimescaleDB로 차량 텔레메트리를 수집하고 콜드체인 상태를 관제하는 개인 프로젝트

FrostRoute는 가상의 냉장 물류 차량이 보내는 위치·온도 데이터를 실시간으로 수집하고,
저장·조회·이상 감지까지 이어지는 전체 흐름을 직접 설계하고 검증하기 위한 프로젝트입니다.

## 해결하려는 문제

차량 텔레메트리 시스템은 정상적인 데이터만 처리해서는 충분하지 않습니다. 네트워크 단절,
MQTT QoS 1의 중복 전달, 지연 재전송, 순서 역전과 저장 장애를 함께 고려해야 합니다.
FrostRoute는 이런 상황에서도 데이터 이력과 최신 상태를 일관되게 유지하는 구조를 목표로 합니다.

## 핵심 기능

- 다중 가상 차량의 위치·온도·속도·문 상태 생성
- MQTT v5/QoS 1 기반 텔레메트리 발행과 수집
- 중복·지연·순서 역전을 고려한 멱등 저장
- TimescaleDB 기반 시계열 이력과 최신 차량 상태 관리
- 온도 이상과 통신 두절 이벤트 감지
- 관리자 인증과 차량·이벤트 관리
- 지도·차트를 이용한 차량 관제 화면
- Docker Compose 로컬 환경과 Terraform 배포 기반

## 아키텍처

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

하나의 pnpm 모노레포에서 관리하지만 simulator, ingestor, API, web은 독립 실행 가능한
애플리케이션으로 유지합니다. 애플리케이션 사이는 MQTT, HTTP, PostgreSQL처럼 명시적인
연결과 계약을 사용합니다.

## 기술 스택

| 영역               | 기술                                            |
| ------------------ | ----------------------------------------------- |
| Language           | TypeScript, Node.js 24 LTS                      |
| Workspace          | pnpm monorepo                                   |
| Simulator·Ingestor | MQTT.js                                         |
| MQTT Broker        | Eclipse Mosquitto                               |
| API                | NestJS, Express                                 |
| Web                | Next.js App Router                              |
| Database           | PostgreSQL, TimescaleDB, Drizzle ORM            |
| Validation         | Zod                                             |
| Infrastructure     | Docker Compose, Terraform, Caddy                |
| Quality            | ESLint, Prettier, Vitest, Testcontainers, Husky |

## 설계 원칙

- 같은 메시지를 다시 받아도 결과가 달라지지 않는 멱등 처리
- 측정 시각·수신 시각·마지막 유효 통신 시각의 분리
- 지연 데이터의 이력 보존과 최신 상태 오염 방지
- 애플리케이션 간 직접 import를 금지한 서비스 경계
- 요구가 확인되기 전 RabbitMQ·Redis·Kubernetes 도입 보류
- 기술 고정보다 측정 결과와 ADR을 이용한 선택

## 모노레포 구성

```text
frost-route/
├── apps/                 # simulator, ingestor, api, web
├── packages/             # contracts, database, config
├── infrastructure/       # docker, terraform
└── docs/                 # Plan, Design, 검증 및 개발 문서
```

## 현재 단계

```text
[Plan] 완료 → [Design] 완료 → [Do] 진행 → [Check] 대기 → [Report] 대기
```

첫 구현 단계는 pnpm workspace와 공통 개발 도구를 구성하는 작업입니다.

## 문서

- [기능 계획](docs/01-plan/features/cold-chain-fleet-monitoring.plan.md)
- [기술 설계 색인](docs/02-design/features/cold-chain-fleet-monitoring.design.md)
- [개발 컨벤션](docs/01-plan/convention.md)
- [N인 협업 정책](docs/01-plan/team-workflow.md)
- [로컬 개발 환경](docs/development/local-setup.md)
- [macOS·Windows Git 설정](docs/development/git-setup.md)
