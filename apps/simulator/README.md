# Vehicle Simulator

고정된 도로 경로를 따라 이동하는 가상 차량이 MQTT v5/QoS 1 telemetry를 발행한다.
현재 Issue 범위는 정상 주행이며 단절·중복·지연·온도 이상 시나리오는 후속 작업에서 추가한다.

## 운행 경로

- 기본 배정은 `vehicleId + random seed` hash를 경로 가중치에 적용한다.
- 서울 도심 순환 50%, 서울-인천 20%, 서울-대전 20%, 서울-부산 10%
- 서울 도심은 순환하고 나머지 경로는 목적지에서 같은 도로를 따라 복귀한다.
- `SIMULATOR_ROUTE_ID`를 지정하면 모든 차량을 특정 경로에 고정할 수 있다.
- 좌표 이동: `speedKph × elapsed time`으로 계산한 실제 거리를 도로 polyline에 적용
- 초기 위치: `vehicleId + random seed` hash로 각 경로상에 결정적으로 분산

경로 fixture는 OpenStreetMap 도로 데이터를 사용하는 OSRM 결과를 2026-08-13에 고정한
WGS84 좌표다. 실행 중 외부 지도 API를 호출하지 않으므로 동일 설정의 이동을 재현할 수 있다.
화면 구현 시 동일 좌표를 NAVER Maps polyline과 차량 marker로 표시하고 도로 정합성을 육안
검증해야 한다. 지도 데이터 출처: © OpenStreetMap contributors, ODbL.

## 실행

저장소 루트에서 로컬 인프라와 simulator를 실행한다.

```bash
cp .env.example .env
pnpm infra:up
pnpm --filter @frost-route/simulator build
pnpm --filter @frost-route/simulator start
```

기본값은 차량 1대가 1초마다 발행한다. `.env`의 다음 값을 변경해 규모와 주기를 조절한다.

```text
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
SIMULATOR_VEHICLE_COUNT=1
SIMULATOR_INTERVAL_MS=1000
SIMULATOR_RANDOM_SEED=20260804
SIMULATOR_ROUTE_ID=
```

특정 경로 ID는 `seoul-urban-loop`, `seoul-incheon`, `seoul-daejeon`,
`seoul-busan` 중 하나를 사용한다. 경로별 속도 범위는 각각 도심 20–45km/h,
수도권 35–70km/h, 중부권 60–90km/h, 장거리 70–100km/h다.

로컬 Mosquitto는 익명 접속을 허용하므로 username과 password를 비워둔다. 두 값은 인증이
필요한 broker에서만 함께 설정한다.

## MQTT 흐름 확인

simulator 실행 전에 별도 터미널에서 전체 차량 telemetry를 구독한다.

```bash
pnpm infra:compose exec mosquitto \
  mosquitto_sub -V mqttv5 -q 1 -t 'fleet/+/telemetry' -v
```

출력에는 topic과 JSON payload가 함께 표시된다.

```text
fleet/VH-001/telemetry {"schemaVersion":1,"vehicleId":"VH-001",...}
```

확인할 항목:

- 차량별 topic의 `vehicleId`와 payload의 `vehicleId` 일치
- 차량별 `sessionId` 유지
- `sequence`가 0부터 1씩 증가
- `recordedAt`이 UTC ISO 8601 형식
- 위치·속도·온도가 계약 범위 안에서 변화

종료할 때 simulator에서 `Ctrl+C`를 누른 뒤 인프라를 내린다.

```bash
pnpm infra:down
```
