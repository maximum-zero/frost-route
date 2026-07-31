# Applications

독립 실행 가능한 FrostRoute 애플리케이션을 배치한다.

- `simulator`: 가상 차량 텔레메트리 생성
- `ingestor`: MQTT 구독과 TimescaleDB 저장
- `api`: NestJS 기반 관제·관리 API
- `web`: Next.js 기반 관제 화면

각 애플리케이션은 독립 entrypoint, 환경 변수, Dockerfile, health check를 가진다.
