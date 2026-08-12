import { describe, expect, it } from 'vitest';

import { parseSimulatorConfig } from './config.js';
import { createDeterministicRandom } from './deterministic-random.js';
import { calculateRemainingDelayMs } from './mqtt-publisher.js';
import { getRouteById, VEHICLE_ROUTES } from './route-catalog.js';
import {
  calculateDistanceMeters,
  getRoutePathLengthMeters,
  getRouteTravelLengthMeters,
  locateRoutePosition,
} from './route-geometry.js';
import { selectRouteForVehicle } from './route-selection.js';
import { createNextTelemetry, createVehicleState } from './vehicle-simulator.js';

const VALID_MQTT_ENVIRONMENT = { MQTT_URL: 'mqtt://localhost:1883' } as const;

describe('simulator 설정', () => {
  it('기본 설정을 적용한다', () => {
    expect(parseSimulatorConfig(VALID_MQTT_ENVIRONMENT)).toEqual({
      mqttUrl: 'mqtt://localhost:1883',
      vehicleCount: 1,
      intervalMs: 1_000,
      randomSeed: 20_260_804,
    });
  });

  it('MQTT broker URL을 필수로 요구한다', () => {
    expect(() => parseSimulatorConfig({})).toThrow();
  });

  it('차량 수와 발행 주기의 허용 범위를 검증한다', () => {
    expect(() =>
      parseSimulatorConfig({ ...VALID_MQTT_ENVIRONMENT, SIMULATOR_VEHICLE_COUNT: '0' }),
    ).toThrow();
    expect(() =>
      parseSimulatorConfig({ ...VALID_MQTT_ENVIRONMENT, SIMULATOR_VEHICLE_COUNT: '101' }),
    ).toThrow();
    expect(() =>
      parseSimulatorConfig({ ...VALID_MQTT_ENVIRONMENT, SIMULATOR_INTERVAL_MS: '99' }),
    ).toThrow();
  });

  it('MQTT username과 password를 함께 요구한다', () => {
    expect(() =>
      parseSimulatorConfig({ ...VALID_MQTT_ENVIRONMENT, MQTT_USERNAME: 'simulator' }),
    ).toThrow();
    expect(() =>
      parseSimulatorConfig({ ...VALID_MQTT_ENVIRONMENT, MQTT_PASSWORD: 'secret' }),
    ).toThrow();
  });

  it('등록된 특정 경로만 허용한다', () => {
    expect(
      parseSimulatorConfig({
        ...VALID_MQTT_ENVIRONMENT,
        SIMULATOR_ROUTE_ID: 'seoul-busan',
      }),
    ).toMatchObject({
      routeId: 'seoul-busan',
    });
    expect(() =>
      parseSimulatorConfig({ ...VALID_MQTT_ENVIRONMENT, SIMULATOR_ROUTE_ID: 'unknown' }),
    ).toThrow();
  });
});

describe('재현 가능한 난수', () => {
  it('같은 seed에서 같은 난수열을 생성한다', () => {
    const first = createDeterministicRandom(42);
    const second = createDeterministicRandom(42);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});

describe('발행 tick', () => {
  it('처리 시간을 제외한 남은 시간만 기다린다', () => {
    expect(calculateRemainingDelayMs(1_000, 250)).toBe(750);
  });

  it('처리가 tick을 초과하면 추가로 기다리지 않는다', () => {
    expect(calculateRemainingDelayMs(1_000, 1_250)).toBe(0);
  });

  it('유한하지 않은 tick 시간을 거부한다', () => {
    expect(() => calculateRemainingDelayMs(Number.POSITIVE_INFINITY, 0)).toThrow();
  });
});

describe('도로 기반 경로 이동', () => {
  it('서울·인천·대전·부산 경로 catalog를 제공한다', () => {
    expect(VEHICLE_ROUTES.map(({ id }) => id)).toEqual([
      'seoul-urban-loop',
      'seoul-incheon',
      'seoul-daejeon',
      'seoul-busan',
    ]);
    expect(VEHICLE_ROUTES.reduce((sum, route) => sum + route.selectionWeight, 0)).toBe(100);
  });

  it('같은 vehicle ID와 seed에 같은 경로를 배정하고 특정 경로로 덮어쓴다', () => {
    const first = selectRouteForVehicle('VH-042', 42);
    const second = selectRouteForVehicle('VH-042', 42);

    expect(first.id).toBe(second.id);
    expect(selectRouteForVehicle('VH-042', 42, 'seoul-busan').id).toBe('seoul-busan');
  });

  it('100대의 경로 배정이 모든 가중치 구간을 사용한다', () => {
    const counts = Object.fromEntries(VEHICLE_ROUTES.map(({ id }) => [id, 0]));
    for (let index = 0; index < 100; index += 1) {
      const vehicleId = `VH-${(index + 1).toString().padStart(3, '0')}`;
      const route = selectRouteForVehicle(vehicleId, 20_260_804);
      counts[route.id] = (counts[route.id] ?? 0) + 1;
    }

    expect(counts['seoul-urban-loop']).toBeGreaterThanOrEqual(40);
    expect(counts['seoul-urban-loop']).toBeLessThanOrEqual(60);
    expect(counts['seoul-incheon']).toBeGreaterThanOrEqual(10);
    expect(counts['seoul-incheon']).toBeLessThanOrEqual(30);
    expect(counts['seoul-daejeon']).toBeGreaterThanOrEqual(10);
    expect(counts['seoul-daejeon']).toBeLessThanOrEqual(30);
    expect(counts['seoul-busan']).toBeGreaterThanOrEqual(3);
    expect(counts['seoul-busan']).toBeLessThanOrEqual(17);
  });

  it('서울 경로 순환 경계에서 위치가 순간이동하지 않는다', () => {
    const route = getRouteById('seoul-urban-loop');
    const routeLength = getRouteTravelLengthMeters(route);
    const beforeBoundary = locateRoutePosition(route, routeLength - 5);
    const afterBoundary = locateRoutePosition(route, routeLength + 5);

    expect(calculateDistanceMeters(beforeBoundary, afterBoundary)).toBeLessThan(12);
  });

  it('장거리 경로의 목적지에서 같은 도로를 역방향으로 복귀한다', () => {
    const route = getRouteById('seoul-daejeon');
    const pathLength = getRoutePathLengthMeters(route);
    const outbound = locateRoutePosition(route, pathLength - 10);
    const returning = locateRoutePosition(route, pathLength + 10);
    const headingDifference = Math.abs(outbound.heading - returning.heading);

    expect(calculateDistanceMeters(outbound, returning)).toBeLessThan(1);
    expect(Math.min(headingDifference, 360 - headingDifference)).toBeCloseTo(180, 3);
    expect(getRouteTravelLengthMeters(route)).toBeCloseTo(pathLength * 2, 5);
  });

  it('경로상의 모든 좌표와 방향이 telemetry 허용 범위 안에 있다', () => {
    for (const route of VEHICLE_ROUTES) {
      const travelLength = getRouteTravelLengthMeters(route);
      for (let index = 0; index <= 20; index += 1) {
        const position = locateRoutePosition(route, travelLength * (index / 20));

        expect(position.latitude).toBeGreaterThanOrEqual(-90);
        expect(position.latitude).toBeLessThanOrEqual(90);
        expect(position.longitude).toBeGreaterThanOrEqual(-180);
        expect(position.longitude).toBeLessThanOrEqual(180);
        expect(position.heading).toBeGreaterThanOrEqual(0);
        expect(position.heading).toBeLessThan(360);
      }
    }
  });
});

describe('차량 telemetry 생성', () => {
  it('차량 번호로 코드와 새 session을 생성한다', () => {
    const first = createVehicleState(1, 42, 'seoul-urban-loop');
    const second = createVehicleState(1, 42, 'seoul-urban-loop');

    expect(first.vehicleId).toBe('VH-001');
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.sequence).toBe(0);
    expect(first.routeId).toBe('seoul-urban-loop');
  });

  it('유효한 정상 telemetry와 다음 상태를 생성한다', () => {
    const state = createVehicleState(1, 42, 'seoul-urban-loop');
    const random = createDeterministicRandom(42);
    const recordedAt = new Date('2026-08-04T10:20:30.000Z');

    const result = createNextTelemetry(state, recordedAt, random, 2_000);

    expect(result.message.vehicleId).toBe('VH-001');
    expect(result.message.sequence).toBe(0);
    expect(result.message.recordedAt).toBe(recordedAt.toISOString());
    expect(result.message.cargo.doorOpen).toBe(false);
    expect(result.nextState.sequence).toBe(1);
    expect(result.nextState.distanceAlongRouteMeters - state.distanceAlongRouteMeters).toBeCloseTo(
      (result.message.speedKph / 3.6) * 2,
      8,
    );
  });

  it('발행 주기에 비례해 같은 속도의 이동 거리를 계산한다', () => {
    const state = createVehicleState(1, 42, 'seoul-urban-loop');
    const recordedAt = new Date('2026-08-04T10:20:30.000Z');
    const oneSecond = createNextTelemetry(state, recordedAt, () => 0, 1_000);
    const twoSeconds = createNextTelemetry(state, recordedAt, () => 0, 2_000);
    const oneSecondDistance =
      oneSecond.nextState.distanceAlongRouteMeters - state.distanceAlongRouteMeters;
    const twoSecondDistance =
      twoSeconds.nextState.distanceAlongRouteMeters - state.distanceAlongRouteMeters;

    expect(twoSecondDistance).toBeCloseTo(oneSecondDistance * 2, 8);
  });
});
