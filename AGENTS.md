# FrostRoute 에이전트 작업 규칙

## 1. 프로젝트 기준

- 프로젝트 수준: 사용자 정의 인프라를 사용하는 Dynamic
- 저장소 형태: pnpm 모노레포
- 실행 애플리케이션: simulator, ingestor, API, web
- API 프레임워크: NestJS 기본 Express adapter
- 실행 연결: MQTT, HTTP, PostgreSQL
- 데이터 저장소: TimescaleDB/PostgreSQL
- 로컬 인프라: Docker Compose
- 클라우드 인프라: Terraform
- bkend.ai 미사용

`apps/*`는 각각 독립 실행·배포 가능한 애플리케이션으로 유지한다. 하나의
저장소를 사용한다는 이유로 애플리케이션 사이의 실행 경계를 제거하지 않는다.

## 2. 세션 시작 절차

모든 작업 시작 시 다음 순서를 따른다.

1. `docs/.pdca-status.json` 확인
2. `bkit_init` 또는 `bkit_get_status` 호출
3. 활성 기능의 Plan과 Design 확인
4. `docs/01-plan/convention.md` 확인
5. `docs/01-plan/team-workflow.md` 확인
6. Git 상태와 기존 변경 확인
7. 할당된 작업 범위와 수정 예정 파일 확인

### 문서 우선순위

문서 또는 지침이 충돌하면 다음 순서를 따른다.

1. 사용자의 최신 지시
2. 활성 기능의 승인된 Plan과 Design
3. 루트 `AGENTS.md`
4. `docs/01-plan/team-workflow.md`
5. `docs/01-plan/convention.md`
6. 기타 참고 문서

### 작업별 필수 참조

| 작업 | 추가 확인 문서 |
|---|---|
| 신규 기능 | 해당 기능의 Plan, Design 색인, 담당 기능 Design |
| 공통 구조 변경 | `cold-chain-fleet-monitoring/00-common.design.md` |
| 에뮬레이터 변경 | `01-vehicle-simulator.design.md` |
| MQTT·수집 변경 | `02-telemetry-ingestion.design.md`, 협업 정책의 공용 계약 변경 |
| 차량 관리 변경 | `03-vehicle-management.design.md` |
| 이벤트 변경 | `04-event-monitoring.design.md` |
| 관제 UI·지도 변경 | `05-monitoring-dashboard.design.md` |
| Terraform·Docker 변경 | `06-deployment.design.md`, `docs/development/git-setup.md` |
| 관리자 인증·세션 변경 | `07-admin-authentication.design.md` |
| Git·PR 작업 | 개발 컨벤션, 협업 정책, `docs/development/git-setup.md` |

## 3. bkit 프로젝트 수준

bkit 자동 감지 결과보다 이 프로젝트에 명시된 수준과 승인된 설계를 우선한다.

### Dynamic 프로젝트 지침

- Plan → Design → Do → Check → Report 단계 준수
- MQTT와 TimescaleDB 직접 연동
- API, 웹, 데이터베이스 단계 포함
- 기능 구현 전 Plan과 Design 확인
- 구현 완료 후 gap analysis 수행

## 4. PDCA 상태 관리

- 항상 `docs/.pdca-status.json`에서 활성 기능 확인
- 기능 구현 전 `bkit_pre_write_check` 수행
- 승인된 설계와 다른 구현이 필요하면 구현 중지 후 문서 갱신
- 중요한 소스 변경 후 bkit 사후 기록 수행
- 구현 단계 완료 전 Do 상태를 임의로 완료 처리하지 않음
- 오타나 동작을 바꾸지 않는 약 10줄 이하의 문서 수정은 별도 Plan 없이 처리 가능

## 5. 작업 범위

- 작업 Issue 또는 합의된 작업 단위 확인 후 수정
- 기존 미커밋 변경을 다른 개발자의 작업으로 간주
- 기존 변경의 임의 삭제·되돌리기·덮어쓰기 금지
- 담당 범위 밖 파일 수정 시 이유와 영향 기록
- 기능 변경과 무관한 리팩터링의 동일 작업 포함 금지
- 하나의 Issue에 한 명의 주 담당자 지정
- 같은 파일을 두 Codex 세션에서 동시에 수정하지 않음

## 6. 모노레포 경계

허용:

```text
apps/* -> packages/*
packages/database -> packages/contracts
```

금지:

```text
apps/* -> apps/*
packages/* -> apps/*
```

- 애플리케이션 사이의 실행 연결은 MQTT, HTTP, PostgreSQL 사용
- 공용 코드는 실제 소비자가 둘 이상일 때만 `packages/*`로 이동
- simulator 전용 로직의 contracts 이동 금지
- web에서 API 내부 타입 직접 import 금지
- API에서 ingestor 내부 코드 직접 import 금지

## 7. 공용 계약 변경

다음 변경은 producer와 consumer 영향을 함께 확인한다.

- `packages/contracts`
- `packages/database`
- MQTT topic과 payload
- HTTP 요청·응답
- 환경 변수
- DB migration

결과 보고에 다음 내용을 포함한다.

- 변경 계약
- 영향받는 producer
- 영향받는 consumer
- 하위 호환 여부
- migration 필요 여부

## 8. 개발 규칙

`docs/01-plan/convention.md`를 기준 문서로 사용한다.

- TypeScript strict 사용
- 명시적 `any` 금지
- 외부 입력의 경계 검증
- 메시지 중복·지연·순서 역전 고려
- DB transaction 범위 명시
- credential과 전체 민감 payload 로그 출력 금지
- secret, `.env`, Terraform state 커밋 금지

## 9. 검증

완료 보고 전 변경 범위에 맞게 다음 검증을 수행한다.

- lint
- typecheck
- unit test
- MQTT 또는 DB 변경 시 integration test
- 애플리케이션 또는 공용 설정 변경 시 build
- Terraform 변경 시 `terraform fmt -check`, `terraform validate`

실행한 명령, 성공 여부, 실행하지 못한 검증과 이유를 보고한다.

## 10. Git

- 사용자 요청 없는 커밋·push·PR 생성 금지
- Git 이력이 없는 저장소의 최초 기준선 커밋 한 번만 Issue·브랜치·PR 규칙과
  `main` 직접 생성의 예외로 허용
- 모든 작업 브랜치는 연결할 GitHub Issue 생성 후 생성
- 브랜치 이름은 `<type>/<issue-number>-<kebab-case-summary>` 형식 사용
- 관련 없는 파일 staging 금지
- 다른 개발자 커밋의 amend·rebase·재작성 금지
- 최초 기준선 이후 `main` 직접 push와 모든 `main` 강제 push 금지
- PR 병합 전 `origin/main` 기준 rebase 수행
- merge commit과 squash merge 금지
- GitHub `Rebase and merge` 사용
- rebase 후 본인 feature branch에만 `--force-with-lease` 허용
- 일반 `--force` 사용 금지
- 커밋 제목은 한글 명사형 사용
- 커밋 상세는 한글 불릿 목록 사용

형식:

```text
<type>(<scope>): <한글 명사형 제목>

- <변경 내용>
- <변경 내용>
- <검증 또는 영향>
```

예:

```text
feat(ingestor): 텔레메트리 멱등 저장 구현

- MQTT 메시지 계약 검증 추가
- 접수 이력 기반 중복 저장 방지
- 텔레메트리 저장 통합 테스트 추가
```

브랜치 예:

```text
feat/42-mqtt-ingestor
fix/57-duplicate-message
docs/61-team-workflow
```

## 11. 작업 인계

구현 완료 보고에 다음 내용을 포함한다.

- 변경 범위
- 주요 결정
- 변경 파일
- 검증 결과
- 계약·migration 영향
- 남은 위험
- 권장 다음 작업

## 12. 응답 형식

모든 응답 마지막에 다음 내용을 포함한다.

```text
[Feature: 기능명 | Phase: 단계 | Progress: 진행률%]

체크리스트
- 완료 사항
- 남은 사항

다음 단계
- 구체적인 다음 작업 또는 명령
```
