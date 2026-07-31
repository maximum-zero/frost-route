# 콜드체인 차량 관제 - 설계 색인

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 프로젝트 수준: Dynamic | 계획: [기능 계획](../../01-plan/features/cold-chain-fleet-monitoring.plan.md)

이 문서는 bkit의 기능별 Design 기본 경로를 유지하면서 분리된 설계 문서를
찾기 위한 색인이다. 구현과 검토 시 이 파일만 읽지 않고 담당 기능의 상세 설계와
공통 설계를 함께 확인한다.

## 1. 공통 설계

- [00 공통 아키텍처와 개발 기준](cold-chain-fleet-monitoring/00-common.design.md)

다음 내용의 기준 문서다.

- 기술 스택
- 모노레포와 서비스 경계
- 시스템 아키텍처
- 공통 환경 변수
- 관측 가능성
- 보안과 오류 형식
- RabbitMQ 도입 기준

## 2. 기능별 설계

| 기능 | 설계 문서 | 관련 요구사항 | 주요 담당 앱 |
|---|---|---|---|
| 01 차량 에뮬레이터 | [01-vehicle-simulator.design.md](cold-chain-fleet-monitoring/01-vehicle-simulator.design.md) | FR-01, FR-08 | `apps/simulator` |
| 02 텔레메트리 수집 | [02-telemetry-ingestion.design.md](cold-chain-fleet-monitoring/02-telemetry-ingestion.design.md) | FR-02~FR-06 | `apps/ingestor`, `packages/contracts`, `packages/database` |
| 03 차량 관리 | [03-vehicle-management.design.md](cold-chain-fleet-monitoring/03-vehicle-management.design.md) | FR-09 | `apps/api`, `packages/database` |
| 04 이상 이벤트 | [04-event-monitoring.design.md](cold-chain-fleet-monitoring/04-event-monitoring.design.md) | FR-11, FR-12 | `apps/ingestor`, `apps/api`, `apps/web` |
| 05 관제 화면 | [05-monitoring-dashboard.design.md](cold-chain-fleet-monitoring/05-monitoring-dashboard.design.md) | FR-07, FR-10, FR-13, FR-14 | `apps/api`, `apps/web` |
| 06 배포 기반 | [06-deployment.design.md](cold-chain-fleet-monitoring/06-deployment.design.md) | 비기능 요구사항 | `infrastructure/*` |
| 07 관리자 인증 | [07-admin-authentication.design.md](cold-chain-fleet-monitoring/07-admin-authentication.design.md) | FR-15, FR-16 | `apps/api`, `apps/web`, `packages/database` |

## 3. 구현 순서

1. 공통 workspace와 개발 규칙
2. Docker Compose 기반 로컬 인프라
3. 공용 텔레메트리 계약
4. 차량 에뮬레이터
5. 텔레메트리 수집과 TimescaleDB 저장
6. 관리자 인증
7. 차량 관리 API
8. 이상 이벤트 감지
9. 관제 API와 웹
10. 실시간 전송 기술 검증과 결정 기록
11. 장애·성능 검증
12. Terraform 배포 기반

## 4. 변경 규칙

- 공통 기술·서비스 경계 변경: `00-common.design.md` 수정
- 한 기능에만 적용되는 변경: 해당 기능 Design만 수정
- MQTT·HTTP·DB 공용 계약 변경: 관련 기능 Design 전부 영향 검토
- 요구사항 범위 변경: Plan과 이 색인의 요구사항 매핑 동시 수정
- 기능 Design 추가·삭제: 이 색인과 `AGENTS.md` 작업별 참조 동시 수정

## 5. 전체 완료 기준

- FR-01~FR-17 구현
- 각 기능 Design의 완료 기준 충족
- 100대 × 1 message/second의 10분 검증
- 정상 메시지 저장 누락 0건
- 의도하지 않은 중복 telemetry 0건
- 온도 이상과 통신 두절 이벤트 재현
- 지도 키 유무에 따른 화면 동작 확인
- 관리자 로그인과 보호된 업무 API 접근 확인
- 최신 상태 5초 이내 반영과 연결 복구 확인
- Terraform format과 validate 통과
- 설계와 구현의 Match Rate 90% 이상
