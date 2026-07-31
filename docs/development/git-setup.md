# macOS·Windows Git 개발 환경 설정

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인

## 1. 공통 설정

두 개발자 모두 다음 설정을 적용한다.

```bash
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global fetch.prune true
git config --global push.autoSetupRemote true
git config --global rerere.enabled true
git config --global core.autocrlf false
```

| 설정 | 목적 |
|---|---|
| `init.defaultBranch` | 기본 브랜치 `main` 통일 |
| `pull.rebase` | pull 과정의 merge commit 방지 |
| `rebase.autoStash` | 로컬 변경 임시 보관 후 rebase |
| `fetch.prune` | 삭제된 원격 브랜치 정리 |
| `push.autoSetupRemote` | 첫 push의 upstream 자동 설정 |
| `rerere.enabled` | 반복 충돌 해결 결과 재사용 |
| `core.autocrlf` | 줄바꿈 처리를 `.gitattributes`로 일원화 |

`autoStash`는 작업 보존을 보장하지 않는다. rebase 전 `git status`를 확인한다.

## 2. Windows 추가 설정

```bash
git config --global core.longpaths true
```

- Git for Windows 설치
- Husky hook 실행을 위한 Git shell 사용
- Windows 예약 파일명 사용 금지
- 지나치게 깊은 디렉터리 구조 지양

예약 파일명:

```text
CON, PRN, AUX, NUL, COM1~COM9, LPT1~LPT9
```

## 3. 줄바꿈

- 기본 텍스트: LF
- `.bat`, `.cmd`: CRLF
- PowerShell: LF
- Git 기준: `.gitattributes`
- 편집기 기준: `.editorconfig`

기존 파일의 줄바꿈 정책을 다시 적용할 필요가 있을 때는 별도 브랜치에서 다음
작업을 수행하고 formatting 변경만 포함한 독립 PR로 제출한다.

```bash
git add --renormalize .
```

## 4. 파일명과 심볼릭 링크

- 파일과 디렉터리의 kebab-case 사용
- 대소문자만 다른 파일 생성 금지
- 대소문자 변경 시 임시 파일명을 거친 `git mv` 사용
- 프로젝트 내부 심볼릭 링크 커밋 금지
- pnpm workspace를 통한 package 연결

대소문자 변경 예:

```bash
git mv fleetmap.tsx temp-map.tsx
git mv temp-map.tsx fleet-map.tsx
```

## 5. Rebase 작업

Git 이력이 없는 저장소는 최초 기준선 커밋 한 번만 `main`에 생성할 수 있다.
최초 커밋 이후에는 아래 Issue·브랜치·PR 절차를 예외 없이 적용한다.

작업 전 GitHub Issue를 생성하고 Issue 번호를 포함한 브랜치를 만든다.

```bash
git switch -c feat/42-mqtt-ingestor
```

형식:

```text
<type>/<issue-number>-<kebab-case-summary>
```

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

- 본인 feature branch에서만 rebase 수행
- 일반 `--force` 사용 금지
- `main` 강제 push 금지
- 다른 개발자가 사용하는 브랜치의 rebase 금지
- 충돌 해결 후 관련 검증 재실행
- PR 병합 방식으로 `Rebase and merge` 사용

## 6. Node와 pnpm

workspace scaffold에서 다음 항목을 저장소에 고정한다.

```json
{
  "engines": {
    "node": "<확정 버전 범위>"
  },
  "packageManager": "pnpm@<확정 버전>"
}
```

공통 설치:

```bash
corepack enable
corepack install
pnpm install --frozen-lockfile
```

- `pnpm-lock.yaml` 필수 커밋
- `node_modules`, 개인 pnpm store 커밋 금지
- 버전 변경 PR의 package.json과 lockfile 동시 반영

## 7. 크로스 플랫폼 script

package script에서 운영체제 전용 shell 명령을 직접 사용하지 않는다.

| 지양 | 대안 |
|---|---|
| `rm -rf` | Node script 또는 `rimraf` |
| `cp` | Node script |
| inline 환경 변수 | 설정 파일 또는 `cross-env` |
| `docker-compose` | `docker compose` |

Husky hook은 복잡한 shell 로직 없이 다음 수준으로 유지한다.

```text
pre-commit -> pnpm exec lint-staged
```

## 8. 로컬 전용 설정

다음 항목은 저장소에 커밋하지 않는다.

- Git 사용자 이름과 이메일
- SSH·GPG key
- Codex와 bkit 설치 경로
- 클라우드 credential
- 실제 `.env`
- 개인 IDE 설정
