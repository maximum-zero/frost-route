# 관리자 인증 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 관련 요구사항: FR-15, FR-16
> 문서 순서: 07 | 공통 기준: [공통 설계](00-common.design.md)

## 1. 범위

MVP는 이메일과 비밀번호를 이용한 단일 `ADMIN` 역할만 제공한다.

포함:

- 관리자 로그인·로그아웃
- 현재 로그인 관리자 조회
- 로그인한 관리자의 비밀번호 변경
- CLI 기반 최초 관리자 생성과 비밀번호 재설정
- 서버에서 폐기 가능한 세션

제외:

- 관리자 자체 가입과 초대
- 사용자 관리 화면
- 이메일 비밀번호 찾기
- 소셜 로그인과 MFA
- 다중 역할과 세밀한 권한 관리

## 2. `admins`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | uuid | PK |
| `email` | varchar(320) | NOT NULL |
| `password_hash` | text | NOT NULL |
| `role` | varchar(16) | NOT NULL, `ADMIN` |
| `status` | varchar(16) | NOT NULL, `ACTIVE`·`DISABLED` |
| `last_login_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

- 이메일은 공백 제거와 소문자 정규화 후 저장하고 `lower(email)` unique index로
  애플리케이션 우회와 동시 요청에서도 중복을 방지한다.
- 비밀번호는 Argon2id로 해시하며 평문과 복호화 가능한 형태로 저장하지 않는다.
- 비밀번호 정책은 긴 passphrase와 password manager 사용을 방해하지 않는다.

## 3. `admin_sessions`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | uuid | PK |
| `admin_id` | uuid | `admins.id` FK, NOT NULL |
| `token_hash` | text | UNIQUE, NOT NULL |
| `csrf_token` | text | NOT NULL |
| `expires_at` | timestamptz | NOT NULL |
| `last_seen_at` | timestamptz | NOT NULL |
| `revoked_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL |

- 브라우저에는 CSPRNG로 생성한 256bit opaque token만 전달한다.
- DB에는 원문 token 대신 SHA-256 hash를 저장한다.
- 로그인 시 별도의 256bit CSRF token을 발급해 session에 저장한다. CSRF token만으로
  인증할 수 없으며 로그·URL·cookie에 노출하지 않는다.
- 로그인 성공 시 새 세션을 발급하고 로그아웃 시 현재 세션을 폐기한다.
- 비밀번호 변경·CLI 재설정·계정 비활성화 시 해당 관리자의 모든 세션을 폐기한다.
- idle timeout 30분과 absolute timeout 12시간을 기본값으로 사용한다.
- 만료·폐기 세션은 정기 정리 대상으로 둔다.

## 4. API

| 메서드 | 경로 | 인증 | 기능 |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | 불필요 | 이메일·비밀번호 로그인 |
| `POST` | `/api/v1/auth/logout` | 필요 | 현재 세션 폐기 |
| `GET` | `/api/v1/auth/me` | 필요 | 현재 관리자 조회 |
| `GET` | `/api/v1/auth/csrf` | 필요 | 현재 세션의 CSRF token 조회 |
| `PATCH` | `/api/v1/auth/password` | 필요 | 현재 비밀번호 확인 후 변경 |

로그인 실패는 계정 존재 여부, 비밀번호 오류, 비활성 상태를 구분하지 않는 동일한
응답을 사용한다. 로그인 성공 응답에는 비밀번호 hash와 session token을 포함하지
않고 브라우저가 메모리에 유지할 CSRF token만 포함한다. 페이지 새로고침 후에는
`GET /api/v1/auth/csrf`로 같은 session의 token을 다시 조회한다.

## 5. 쿠키와 요청 보호

- 브라우저는 동일 origin의 상대 `/api/v1` 경로만 호출
- 운영 쿠키: `__Host-frost_route_session`, `HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`, `Domain` 미설정
- 로컬 HTTP 쿠키: `frost_route_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`
- 세션 token의 local storage 저장 금지
- 로그인 성공 시 세션 식별자 교체
- 상태 변경 요청의 `Origin`·`Sec-Fetch-Site`·CSRF token 검증
- 로그인 요청의 `Origin` 검증
- 허용 origin은 환경별 `PUBLIC_ORIGIN`과 정확히 비교
- 계정과 IP를 함께 고려한 로그인 시도 제한
- 영구 계정 잠금 대신 점진적 단기 cooldown 적용
- 단일 API MVP는 in-memory 제한을 허용하되 다중 instance 전환 시 공유 저장소 검토
- HTTPS 외부 접속에서 인증 요청 허용 금지
- 인증 응답의 `Cache-Control: no-store` 적용
- `last_seen_at`은 매 요청마다 쓰지 않고 마지막 갱신 후 1분 이상 지난 경우 갱신

같은 origin의 SSE를 선택하면 브라우저의 세션 쿠키를 그대로 사용할 수 있다.
polling 또는 WebSocket을 선택해도 동일한 서버 세션을 인증 기준으로 유지한다.

현재 opaque session은 서명된 claim을 사용하지 않고 CSRF token도 session에
저장하므로 JWT·HMAC 서명용 secret을 두지 않는다.

## 6. 접근 정책

- `/login`, `/api/v1/auth/login`, 최소 정보의 `/health`는 인증 제외
- 관제 웹 경로는 미인증 시 `/login`으로 이동
- 차량·관제·이력·이벤트 API는 인증 필수
- MQTT 수집기와 내부 readiness는 관리자 세션과 별도 경계 사용
- 이벤트 확인 처리에 관리자 ID 기록

MVP는 역할이 하나이므로 복잡한 authorization 계층을 만들지 않는다. 이후 역할이
추가될 때 별도 기능으로 권한 모델을 설계한다.

## 7. 관리자 초기화

최초 관리자와 비밀번호 분실 복구는 대화형 CLI로 처리한다.

```text
pnpm admin:create --email admin@example.com
pnpm admin:reset-password --email admin@example.com
```

- 비밀번호는 CLI prompt로 입력하고 인자·환경 변수·로그에 남기지 않는다.
- 저장소 seed와 `.env.example`에 실제 credential을 넣지 않는다.
- 운영 실행 권한은 서버 관리자에게만 허용한다.

## 8. 감사와 로그

`admin_audit_logs`:

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | uuid | PK |
| `admin_id` | uuid | `admins.id` FK, NULL |
| `action` | varchar(64) | NOT NULL |
| `outcome` | varchar(16) | SUCCESS·FAILURE |
| `target_type` | varchar(32) | NULL |
| `target_id` | uuid | NULL |
| `request_id` | varchar(64) | NULL |
| `details` | jsonb | NOT NULL, 기본 `{}` |
| `occurred_at` | timestamptz | NOT NULL |

기록:

- 로그인 성공·실패
- 로그아웃
- 비밀번호 변경과 CLI 재설정
- 계정 비활성 접근
- 이벤트 확인 처리
- 차량 등록·수정·비활성화

기록 금지:

- 원문 비밀번호와 비밀번호 hash
- session token과 cookie 전체 값
- 불필요한 개인정보

감사 로그는 MVP에서 30일 보존하고 cleanup 결과를 구조화 로그로 기록한다. 법적
보존 요구가 생기면 기간과 외부 보관 방식을 별도로 검토한다.

## 9. 테스트

- 정상 로그인과 로그아웃
- 잘못된 이메일·비밀번호의 동일한 실패 응답
- 비활성 관리자 로그인 거부
- 인증 없는 관제 API 접근 거부
- idle·absolute 만료 세션 거부
- 로그아웃·비밀번호 변경 후 기존 세션 거부
- CSRF token과 Origin 오류 요청 거부
- 로그인 시도 제한
- cookie 보안 속성
- CLI 생성·재설정 시 credential 비노출
- 비밀번호 변경·재설정·계정 비활성화 후 전체 세션 거부
- 인증 응답 cache 방지
- 감사 로그 기록과 민감정보 비포함

## 10. JWT 전환 검토 기준

현재는 즉시 폐기와 단일 API 운영이 단순한 서버 세션을 사용한다. 다음 조건이
발생하면 JWT 또는 OAuth/OIDC를 별도 ADR과 migration 계획으로 검토한다.

- 모바일 앱이나 외부 API client 추가
- 여러 서비스의 독립적인 인증 검증 필요
- 외부 파트너 API와 표준 위임 인증 필요
- 중앙 세션 조회의 측정된 병목 발생

JWT 전환 시 access·refresh token 수명, rotation, 재사용 감지, 서명 키 교체,
기존 세션과의 병행 기간 및 강제 폐기 방법을 함께 설계한다.

## 11. 완료 기준

- 이메일·비밀번호 기반 관리자 로그인
- 서버 측 세션 조회·만료·폐기
- 관제 화면과 업무 API 보호
- 비밀번호 변경과 CLI 기반 복구
- 인증·세션·CSRF 보안 테스트 통과
- 감사 로그의 인증·주요 관리 작업 추적
- 민감정보 비노출 로그 확인
