# Packages

둘 이상의 애플리케이션이 실제로 공유하는 코드와 계약만 배치한다.

- `contracts`: MQTT payload와 HTTP DTO
- `database`: migration, schema, repository
- `config`: 환경 변수 해석과 검증

애플리케이션 전용 로직을 편의를 이유로 공용 package로 이동하지 않는다.
