# FrostRoute N인 협업 정책

> 버전: 1.1.0 | 작성일: 2026-08-01 | 상태: 승인

## 1. 협업 원칙

- 한 작업에 한 명의 주 담당자 지정
- 짧은 브랜치와 작은 Pull Request 사용
- 공용 계약 변경 전 관련 개발자 공유
- AI 생성 코드에 대한 작성자 책임 유지
- 설계 변경과 구현 변경의 분리
- 자동화보다 명시적인 작업 범위와 리뷰 우선

## 2. 기본 담당 영역

| 영역                 | 기본 담당             |
| -------------------- | --------------------- |
| `apps/simulator`     | Issue별 담당자        |
| `apps/ingestor`      | Issue별 담당자        |
| `apps/api`           | Issue별 담당자        |
| `apps/web`           | Issue별 담당자        |
| `packages/contracts` | 영향 개발자 공동 검토 |
| `packages/database`  | 영향 개발자 공동 검토 |
| `infrastructure`     | 작업별 담당 지정      |
| `docs`               | 기능 담당자           |

기본 담당은 독점 소유권이 아니다. 다른 영역 수정 시 해당 영역 담당자의 리뷰를
받는다.

## 3. 작업 시작

작업 시작 전 다음 내용을 Issue 또는 합의된 작업 기록에 작성한다.

```text
작업 목적:
주 담당자:
수정 예상 영역:
공용 계약 변경:
DB 변경:
환경 변수 변경:
완료 조건:
검증 방법:
```

- 같은 파일의 동시 수정 최소화
- 작업 범위 변경 시 구현 전 기록 갱신
- 하나의 Issue를 두 Codex 세션에서 동시에 구현하지 않음
- 모든 코드·정책 작업의 GitHub Issue 선생성
- Issue 번호가 없는 작업 브랜치 생성 금지

## 4. 브랜치

### 최초 기준선 예외

Git 이력이 없는 저장소의 최초 기준선 커밋은 Issue·작업 브랜치·PR 규칙의 예외로
`main`에 생성하고 최초 원격 저장소 설정에 사용할 수 있다. 이 예외는 최초 커밋
한 번에만 적용하며 이후 모든 변경은 Issue와 작업 브랜치를 사용한다.

- `main` 기반 짧은 feature branch 사용
- `develop` 브랜치 미사용
- 브랜치 이름의 `<type>/<issue-number>-<kebab-case-summary>` 형식 사용
- 한 브랜치에 하나의 작업 목적 유지
- 가능한 1~2일 내 병합
- 병합 전 `git fetch origin`과 `git rebase origin/main` 수행
- 최초 기준선 이후 `main` 직접 push 금지
- merge commit과 squash merge 금지
- GitHub `Rebase and merge` 사용
- rebase 후 본인 feature branch에만 `git push --force-with-lease` 허용
- 일반 `git push --force` 사용 금지
- 다른 개발자가 함께 사용하는 브랜치 rebase 금지

예:

```text
feat/42-telemetry-contract
feat/43-mqtt-ingestor
feat/44-vehicle-dashboard
fix/57-duplicate-message
docs/61-team-workflow
```

GitHub 권장 설정:

```text
Allow merge commits       OFF
Allow squash merging      OFF
Allow rebase merging      ON
Require pull request      ON
Required approvals        단계별 적용
Require status checks     ON
Require branch up to date ON
```

| 개발 단계          | 필수 승인 | 마지막 push 별도 승인 | 병합 조건                  |
| ------------------ | --------- | --------------------- | -------------------------- |
| 단독 scaffold      | 0명       | 비활성화              | 작성자 자체 검토와 CI 통과 |
| N인 협업 시작 이후 | 1명 이상  | 활성화                | 다른 개발자 승인과 CI 통과 |

협업 참여자가 생기는 Issue부터 저장소 관리자가 승인 정책을 강화한다. 인원수와 관계없이
PR 생성, 필수 CI, 최신 `main` 반영, 대화 해결과 Rebase merge 원칙은 유지한다.

## 5. Pull Request

모든 기능 변경은 Pull Request를 거친다. 단독 scaffold 단계에서는 작성자가 diff와 검증
결과를 자체 검토하고, N인 협업 시작 이후에는 다른 개발자의 승인을 받는다.

PR 본문:

```markdown
## 목적

## 주요 변경

## 검증 결과

## 계약 변경

- MQTT:
- HTTP API:
- DB:
- 환경 변수:

## 화면 변경

## 남은 작업
```

리뷰 순서:

1. 요구사항 충족
2. 데이터 유실·중복 가능성
3. 서비스 경계 위반
4. 오류 처리
5. 테스트 적절성
6. 코드 가독성
7. 스타일

스타일과 formatting은 Husky, lint-staged, CI에 우선 위임한다.

## 6. 공용 계약 변경

다음 변경은 공동 검토 대상으로 지정한다.

- MQTT topic과 payload
- HTTP 요청·응답 DTO
- DB schema와 migration
- 환경 변수
- `packages/contracts`
- `packages/database`

변경 절차:

1. 변경 목적 공유
2. producer와 consumer 영향 확인
3. 하위 호환 여부 결정
4. contracts 우선 수정
5. 관련 앱과 테스트 반영
6. migration 및 배포 순서 기록

호환되지 않는 계약 변경은 가능한 하나의 PR에서 원자적으로 반영한다.

## 7. DB migration

- 공유된 migration 파일 수정 금지
- 변경 시 새로운 migration 추가
- 순서가 드러나는 파일명 사용
- 파괴적 변경 전 데이터 보존 방법 작성
- PR에 적용 및 복구 방법 기록
- 동시에 migration 작업 시 번호와 범위 사전 조율

예:

```text
20260731_001_create_vehicles.sql
20260731_002_create_ingested_messages.sql
20260731_003_create_vehicle_telemetry.sql
```

## 8. 환경 변수와 비밀정보

- 실제 `.env` 커밋 금지
- 환경 변수 추가 시 `.env.example` 동시 변경
- 브라우저 공개 변수에만 `NEXT_PUBLIC_` 사용
- 개인 credential 공유 금지
- MQTT 비밀번호, DB URL, Terraform credential 로그 출력 금지
- 배포 secret의 GitHub Actions 또는 서버 환경 관리

## 9. AI 보조 개발

- 사람이 Issue와 작업 범위 결정
- Codex의 합의 범위 내 구현
- 사람이 생성 diff와 실행 결과 확인
- 단계에 따른 자체 검토 또는 다른 개발자의 Pull Request 리뷰
- “Codex 생성 코드”를 리뷰 면제 사유로 사용 금지
- PR 작성자의 구조·실패 동작·테스트 범위 설명 책임
- 승인 설계 변경 필요 시 구현 중지 후 문서 갱신과 공동 확인

Codex 요청에 가능한 다음 경계를 포함한다.

```text
작업 대상:
- apps/ingestor
- packages/contracts

수정 금지:
- apps/api
- apps/web
- infrastructure/terraform
```

## 10. 작업 준비 완료 기준

- 작업 목적 정의
- 관련 Plan·Design 확인
- 수정 앱과 package 확인
- MQTT·API·DB 계약 변경 여부 확인
- 성공 조건과 검증 방법 정의
- 다른 작업과 충돌 가능성 확인

## 11. 작업 완료 기준

- 기능 구현 완료
- lint와 typecheck 통과
- 관련 unit·integration test 통과
- 오류와 빈 데이터 상태 처리
- 계약·migration·환경 변수 문서 반영
- credential 비노출 확인
- 로컬 실행 확인
- 현재 개발 단계에 필요한 리뷰 완료
- `main` 병합 후 기본 동작 확인

## 12. 갈등 해결

- 설계 문서와 합의된 Issue 범위 우선
- 합의되지 않은 대규모 리팩터링 보류
- 두 대안의 장단점과 영향 영역 기록
- 되돌리기 어려운 결정의 공동 승인
- 합의 전 임시 구현의 `main` 병합 금지

## 13. Rebase 충돌

- 본인 담당 파일 충돌의 우선 해결
- 공용 계약과 DB migration 충돌의 단독 판단 금지
- 충돌 해결 후 관련 개발자에게 영향 공유
- migration 번호 충돌 시 신규 번호 부여
- lockfile 충돌 시 수동 병합보다 `pnpm install` 재생성
- 충돌 해결 후 영향 범위의 lint, typecheck, test 재실행

## 14. 커밋 이력

Rebase 병합 후 각 커밋이 `main` 이력에 남으므로 다음 원칙을 적용한다.

- 기능적으로 설명 가능한 커밋 단위 유지
- `작업 중`, `수정`, `최종` 같은 임시 제목 금지
- 병합 전 불필요한 WIP 커밋 정리
- 커밋 재작성은 본인 feature branch에서만 수행
- 다른 개발자가 기반으로 사용 중인 커밋의 재작성 금지

## 15. 문서 버전

- 최초 기준선 커밋까지 버전 문서는 `1.0.0` 유지
- 최초 커밋 이후 실제로 변경한 문서만 버전 증가
- patch: 오탈자와 동작을 바꾸지 않는 설명 보완
- minor: 요구사항, API, schema, 정책의 호환 가능한 추가·변경
- major: 기존 계약과 호환되지 않는 구조 변경
- Git commit과 PR을 변경 이력의 기준으로 사용하고 문서 안에 중복 changelog를 두지 않음
