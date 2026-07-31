# 차량 관리 설계

> 버전: 1.0.0 | 작성일: 2026-07-31 | 상태: 승인
> 관련 요구사항: FR-09
> 문서 순서: 03 | 공통 기준: [공통 설계](00-common.design.md)

## 1. 책임

- 관제 대상 차량 등록
- 차량 기본 정보 수정
- 차량 활성·비활성 전환
- 차량 목록과 상세 조회
- 에뮬레이터 seed와 차량 코드 일치

실제 삭제 API는 제공하지 않는다. 관제 제외는 `is_active`로 처리한다.

## 2. `vehicles`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | uuid | PK |
| `code` | varchar(32) | UNIQUE, NOT NULL |
| `license_plate` | varchar(32) | UNIQUE, NOT NULL |
| `name` | varchar(100) | NOT NULL |
| `temperature_min_c` | numeric(5,2) | NOT NULL |
| `temperature_max_c` | numeric(5,2) | NOT NULL |
| `is_active` | boolean | NOT NULL, 기본 true |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

- `temperature_min_c < temperature_max_c` CHECK
- `code` 변경은 telemetry 연결에 영향을 주므로 MVP에서는 금지

## 3. API

Base path: `/api/v1`

| 메서드 | 경로 | 기능 |
|---|---|---|
| `POST` | `/vehicles` | 차량 등록 |
| `GET` | `/vehicles` | 차량 목록 |
| `GET` | `/vehicles/:vehicleId` | 기본 정보와 최신 상태 |
| `PATCH` | `/vehicles/:vehicleId` | 차량 정보 수정 |

목록은 `isActive`, `cursor`, `limit`을 지원한다.
모든 차량 관리 API는 인증된 관리자만 호출할 수 있다.

## 4. 에뮬레이터 연결

- seed 명령으로 `VH-001`~`VH-100` 생성
- simulator는 같은 seed 설정 사용
- 미등록 차량 telemetry 저장 거부
- 비활성 차량 telemetry 저장 거부와 reason code 로그

## 5. 테스트

- 차량 등록과 unique 충돌
- 온도 범위 CHECK
- 차량 목록 filter와 pagination
- 차량 비활성화
- 미등록·비활성 차량 telemetry 거부 연동

## 6. 완료 기준

- 차량 등록·수정·활성 상태 관리
- seed 차량 100대 생성
- 에뮬레이터 차량 코드와 DB 차량 코드 일치
- 삭제 없이 비활성화 가능한 운영 흐름
