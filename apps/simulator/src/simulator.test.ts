import { describe, expect, it } from 'vitest';

import { parseSimulatorConfig } from './config.js';
import { createDeterministicRandom } from './deterministic-random.js';
import { interpolateRoute } from './route.js';
import { createNextTelemetry, createVehicleState } from './vehicle-simulator.js';

describe('simulator 설정', () => {
  it('기본 설정을 적용한다', () => {
    expect(parseSimulatorConfig({})).toEqual({
      mqttUrl: 'mqtt://localhost:1883',
      vehicleCount: 1,
      intervalMs: 1_000,
      randomSeed: 20_260_804,
    });
  });

  it('차량 수와 발행 주기의 허용 범위를 검증한다', () => {
    expect(() => parseSimulatorConfig({ SIMULATOR_VEHICLE_COUNT: '0' })).toThrow();
    expect(() => parseSimulatorConfig({ SIMULATOR_VEHICLE_COUNT: '101' })).toThrow();
    expect(() => parseSimulatorConfig({ SIMULATOR_INTERVAL_MS: '99' })).toThrow();
  });

  it('MQTT username과 password를 함께 요구한다', () => {
    expect(() => parseSimulatorConfig({ MQTT_USERNAME: 'simulator' })).toThrow();
    expect(() => parseSimulatorConfig({ MQTT_PASSWORD: 'secret' })).toThrow();
  });
});

describe('재현 가능한 난수', () => {
  it('같은 seed에서 같은 난수열을 생성한다', () => {
    const first = createDeterministicRandom(42);
    const second = createDeterministicRandom(42);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});

describe('고정 경로 보간', () => {
  it('진행률에 해당하는 좌표와 방향을 생성한다', () => {
    const start = interpolateRoute(0);
    const middle = interpolateRoute(0.1);

    expect(start.latitude).toBeCloseTo(37.5665);
    expect(start.longitude).toBeCloseTo(126.978);
    expect(middle).not.toEqual(start);
    expect(middle.heading).toBeGreaterThanOrEqual(0);
    expect(middle.heading).toBeLessThan(360);
  });

  it('순환 경로의 진행률을 0~1 범위로 정규화한다', () => {
    expect(interpolateRoute(1)).toEqual(interpolateRoute(0));
    expect(interpolateRoute(-0.5)).toEqual(interpolateRoute(0.5));
  });
});

describe('차량 telemetry 생성', () => {
  it('차량 번호로 코드와 새 session을 생성한다', () => {
    const first = createVehicleState(1);
    const second = createVehicleState(1);

    expect(first.vehicleId).toBe('VH-001');
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.sequence).toBe(0);
  });

  it('유효한 정상 telemetry와 다음 상태를 생성한다', () => {
    const state = createVehicleState(1);
    const random = createDeterministicRandom(42);
    const recordedAt = new Date('2026-08-04T10:20:30.000Z');

    const result = createNextTelemetry(state, recordedAt, random);

    expect(result.message.vehicleId).toBe('VH-001');
    expect(result.message.sequence).toBe(0);
    expect(result.message.recordedAt).toBe(recordedAt.toISOString());
    expect(result.message.cargo.doorOpen).toBe(false);
    expect(result.nextState.sequence).toBe(1);
    expect(result.nextState.routeProgress).toBeGreaterThan(state.routeProgress);
  });
});
