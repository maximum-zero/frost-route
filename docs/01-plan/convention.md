# FrostRoute 개발 컨벤션

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인

## 1. 기본 원칙

- 하나의 저장소에서 관리하되 각 `apps/*`는 독립 실행 단위로 유지
- MQTT, HTTP, PostgreSQL을 통한 서비스 간 연결
- 필요성이 확인되지 않은 추상화와 공용 유틸리티 생성 지양
- 타입, 스키마, 테스트를 통한 서비스 경계 계약 검증
- 정상 흐름과 함께 중복, 지연, 재연결, 저장 실패 검증
- 사람이 검토하는 문서와 커밋 메시지의 한글 작성

## 2. 문서 언어

- README, Plan, Design, 협업 정책, 작업 인계 문서는 한글 작성
- 코드 식별자, 경로, 명령, 프로토콜명, 제품명은 원문 유지
- MQTT topic, HTTP path, DB 이름은 실제 구현 형태 그대로 표기
- 외부 오류 원문은 번역으로 의미가 달라질 수 있으므로 원문과 설명 병기

## 3. 작업 공간 경계

```text
apps/*                    실행 가능한 애플리케이션
packages/contracts        MQTT payload와 HTTP DTO
packages/database         migration, schema, DB 접근
packages/config           환경 변수 해석
infrastructure/docker     로컬 실행 환경
infrastructure/terraform  클라우드 인프라
```

허용 의존성:

```text
apps/* -> packages/*
packages/database -> packages/contracts
```

금지 의존성:

```text
apps/* -> apps/*
packages/* -> apps/*
```

## 4. TypeScript

- `strict` 활성화
- 명시적 `any` 금지 및 외부 입력의 `unknown` 검증
- 객체 계약은 `interface`, union과 utility 조합은 `type` 사용
- TypeScript `enum` 대신 `as const` 객체와 literal union 사용
- 비동기 코드의 `async/await` 우선 사용
- 도메인·애플리케이션 로직의 환경 변수 직접 접근 금지
- MQTT payload, API 입력, 환경 변수의 경계 Zod 검증
- 내부 시간의 UTC ISO 8601 또는 `Date` 사용

## 5. 이름 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 디렉터리·파일 | kebab-case | `vehicle-latest-state.ts` |
| React 컴포넌트 | PascalCase export | `FleetMap` |
| 변수·함수 | camelCase | `receivedAt`, `storeTelemetry` |
| boolean | is/has/can/should 접두사 | `isActive`, `hasConnection` |
| 상수 | UPPER_SNAKE_CASE | `MAX_PAYLOAD_BYTES` |
| interface·type | PascalCase | `TelemetryMessage` |
| SQL 테이블·컬럼 | snake_case, 복수형 테이블 | `vehicle_telemetry`, `received_at` |
| API path | kebab-case 명사 | `/monitoring/vehicles` |
| MQTT topic | 소문자 고정 segment | `fleet/VH-001/telemetry` |

- 함수 이름의 동사 사용
- 이벤트 처리 함수의 `handle*` 접두사 사용
- callback prop의 `on*` 접두사 사용

## 6. 모듈 설계

- 하나의 모듈에 하나의 변경 이유 유지
- API는 NestJS 기능 module을 기준으로 auth, vehicles, monitoring, events를 분리
- controller는 HTTP 변환, provider는 application logic, repository는 DB 접근 담당
- 인증·CSRF는 Guard, 공통 응답·감사는 필요한 범위의 Interceptor 사용
- Nest decorator와 DI container에 domain 객체를 직접 종속시키지 않음
- Express `Request`·`Response`의 service·repository 전달 금지
- 공용 Zod schema를 custom Pipe에서 검증하고 `class-validator` 중복 도입 금지
- 전체 workspace 테스트 runner는 Vitest로 통일하고 Nest 기본 Jest 설정 추가 금지
- 프레임워크 객체의 도메인 로직 전달 금지
- application service에서 DB transaction 경계 명시
- repository의 SQL 저장 책임 한정
- Drizzle을 기본 DB API로 사용하고 직접 `pg` query는 TimescaleDB 전용 SQL처럼
  ORM 표현이 부적합한 경우에만 `packages/database` repository 내부에서 사용
- 실제 두 개 이상의 앱이 사용하는 계약만 shared package에 배치
- package 공개 API에만 barrel `index.ts` 사용

## 7. 오류와 로그

- 예상 가능한 오류에 안정적인 error code 사용
- 오류의 무시 또는 빈 catch 금지
- credential, connection string, 전체 MQTT payload 로그 출력 금지
- 서버 로그의 JSON 구조 출력
- HTTP requestId와 telemetry messageId의 추적 키 사용
- 사용자 메시지와 내부 진단 메시지 분리

## 8. 테스트

- 대상 파일 옆에 `*.test.ts` 또는 `*.test.tsx` 배치
- 순수 도메인 규칙의 unit test 검증
- MQTT, PostgreSQL, TimescaleDB 동작의 integration test 검증
- 외부 시스템의 과도한 mock 지양
- 버그 수정 시 실패 재현 테스트 우선 추가
- 시간 의존 로직의 clock 주입

## 9. 정적 검사와 자동화

- workspace 루트 ESLint flat config와 Prettier 공유
- import 정렬과 미사용 코드 자동 검사
- CI에서 `lint`, `typecheck`, `test`, `build` 수행
- Terraform의 `terraform fmt -check`, `terraform validate` 수행

### Husky

- Husky와 lint-staged 사용
- `pre-commit`에서 변경 파일만 검사
- TypeScript·JavaScript 변경 파일의 ESLint와 Prettier 수행
- JSON·Markdown·YAML 변경 파일의 Prettier 수행
- Terraform 변경 파일의 `terraform fmt` 수행
- 전체 typecheck, test, build의 pre-commit 실행 금지
- 전체 검사의 PR CI 수행
- 초기 commitlint 제외 및 커밋 형식의 리뷰 검증

구체적인 설정 파일은 workspace scaffold 단계에서 패키지 버전에 맞춰 생성한다.

## 10. Git

커밋 형식:

```text
<type>(<scope>): <한글 명사형 제목>

- <한글 명사형 변경 내용>
- <한글 명사형 변경 내용>
- <검증 또는 영향 범위>
```

허용 type:

```text
feat, fix, docs, refactor, test, chore, build, ci, perf
```

예:

```text
feat(ingestor): 텔레메트리 멱등 저장 구현

- MQTT 메시지 계약 검증 추가
- 접수 이력 기반 중복 저장 방지
- 텔레메트리 저장 통합 테스트 추가
```

- 한 커밋에 하나의 설명 가능한 변경 단위 구성
- 생성 파일, secret, local state 커밋 금지
- 실행 가능하고 테스트가 통과하는 `main` 유지
- 짧은 feature branch 기반 trunk-based 방식 사용
- GitHub Issue 생성 후 연결된 작업 브랜치 생성
- 브랜치 이름의 `<type>/<issue-number>-<kebab-case-summary>` 형식 사용
- PR 병합 전 `origin/main` 기준 rebase 수행
- merge commit과 squash merge를 사용하지 않고 Rebase 병합 사용
- rebase 후 본인 feature branch에만 `--force-with-lease` 허용
- 일반 `--force`와 `main` 강제 push 금지
- 제목과 불릿의 `수정함`, `추가했음` 같은 서술형 종결 지양

브랜치 예:

```text
feat/42-mqtt-ingestor
fix/57-duplicate-message
docs/61-team-workflow
```

## 11. 크로스 플랫폼

- 저장소 텍스트의 LF 줄바꿈 사용
- Windows 전용 `.bat`, `.cmd`만 CRLF 사용
- `.gitattributes`를 Git 줄바꿈 기준으로 사용
- `.editorconfig`를 편집기 기준으로 사용
- 프로젝트 파일의 심볼릭 링크 사용 금지
- 파일명의 대소문자만 다른 파일 생성 금지
- package script의 `rm`, `cp`, inline 환경 변수 같은 운영체제 전용 명령 지양
- Node 기반 script 또는 크로스 플랫폼 도구 사용
- `docker compose` 명령 사용
- `pnpm-lock.yaml` 필수 커밋
- 의존성 변경 없는 lockfile 변경 금지
- lockfile 충돌 시 수동 편집 대신 `pnpm install` 재생성

개발자별 Git 설정은 `docs/development/git-setup.md`를 따른다.

## 12. 구현 준비 완료 기준

- 승인된 Plan과 Design
- 앱과 package 경계 정의
- 메시지와 DB 계약 정의
- 환경 변수와 secret 경계 정의
- 핵심 장애 시나리오와 성공 조건 정의
- 첫 구현 단위의 검증 방법 정의
- 담당자와 영향 영역 정의

## 13. 구현 완료 기준

- 승인 요구사항 구현
- 변경 범위 lint·typecheck·test 통과
- 관련 오류·빈 데이터 상태 처리
- 계약·migration·환경 변수 문서 반영
- 로컬 실행 확인
- 상대 개발자 리뷰 완료
- `main` 병합 후 기본 동작 확인
