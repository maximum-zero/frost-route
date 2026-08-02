# FrostRoute 로컬 개발 환경

> 버전: 1.1.0 | 작성일: 2026-08-01 | 상태: 승인

이 문서는 프로젝트 참여자가 로컬 workspace를 동일하게 준비하고 공통 검증 명령을 실행하는
방법을 설명한다. 애플리케이션별 실행 방법은 해당 기능 구현 후 별도 문서에 추가한다.

저장소 clone, GitHub SSH 인증, Git 작성자 정보와 rebase 정책은 먼저
[macOS·Windows Git 개발 환경 설정](git-setup.md)을 적용한다.

## 1. 요구 환경

- Git
- Node.js `>=24.18.0 <25`
- Corepack
- Docker Desktop 또는 Docker Engine과 Compose plugin
- Terraform은 인프라 작업 시 설치

Node 버전 관리 도구를 사용한다면 저장소의 `.nvmrc`에 지정된 버전을 선택한다.

```bash
nvm install
nvm use
```

버전 확인:

```bash
git --version
node --version
corepack --version
docker --version
docker compose version
```

## 2. pnpm 준비

저장소의 `packageManager`에 지정된 pnpm을 Corepack으로 활성화한다.

```bash
corepack enable
corepack install
pnpm --version
```

전역 pnpm 설치보다 저장소에 고정된 버전을 우선한다.

## 3. 의존성 설치

```bash
pnpm install --frozen-lockfile
```

의존성을 변경하려는 작업이 아니라면 lockfile을 수정하지 않는다.

## 4. 공통 검증

루트 `.env.example`을 참고해 `.env`를 생성하고 로컬 비밀번호를 설정한다. `.env`는
Git에서 제외되며 공유하지 않는다. macOS·Linux는 다음 명령을 사용할 수 있다.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

로컬 MQTT·데이터베이스 실행:

```bash
pnpm infra:config
pnpm infra:up
pnpm infra:ps
```

연결 검증과 종료 방법은 [로컬 Docker 인프라](../../infrastructure/docker/README.md)를
따른다.

공통 품질 검증:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Pull Request CI도 같은 명령을 실행한다.

## 5. Git hook

`pnpm install`의 prepare script가 Husky hook을 준비한다. pre-commit은 staging된 파일에만
lint와 format을 수행하며 전체 typecheck·test·build는 실행하지 않는다.

hook 확인:

```bash
pnpm exec lint-staged --version
```

## 6. 운영체제 기준

- macOS와 Windows 모두 `pnpm` script 사용
- Git 줄바꿈 처리는 `.gitattributes` 기준
- shell 전용 `rm`, `cp`, inline 환경 변수 script 사용 금지
- Docker 명령은 `docker compose` 사용
- Windows 예약 파일명과 대소문자만 다른 파일 사용 금지

Git 설정은 [macOS·Windows Git 개발 환경 설정](git-setup.md)을 따른다.

## 7. 문제 확인

설치나 검증에 실패하면 다음 정보를 Issue 또는 Pull Request에 기록한다.

```text
운영체제:
Node.js 버전:
pnpm 버전:
실행 명령:
오류 메시지:
재현 절차:
```
