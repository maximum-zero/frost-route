import { randomUUID } from 'node:crypto';

import { telemetryMessageSchema, type TelemetryMessage } from '@frost-route/contracts';

import { interpolateRoute } from './route.js';

export interface VehicleSimulationState {
  vehicleId: string;
  sessionId: string;
  sequence: number;
  routeProgress: number;
}

/** 차량 번호에 대응하는 초기 session과 경로 위치를 만든다. */
export function createVehicleState(vehicleNumber: number): VehicleSimulationState {
  if (!Number.isInteger(vehicleNumber) || vehicleNumber < 1 || vehicleNumber > 100) {
    throw new RangeError('차량 번호는 1~100 사이 정수여야 합니다.');
  }

  return {
    vehicleId: `VH-${vehicleNumber.toString().padStart(3, '0')}`,
    sessionId: randomUUID(),
    sequence: 0,
    routeProgress: (vehicleNumber - 1) / 100,
  };
}

/** 현재 차량 상태에서 다음 정상 주행 telemetry와 갱신 상태를 생성한다. */
export function createNextTelemetry(
  state: VehicleSimulationState,
  recordedAt: Date,
  random: () => number,
): { message: TelemetryMessage; nextState: VehicleSimulationState } {
  const position = interpolateRoute(state.routeProgress);
  const speedKph = 35 + random() * 15;
  const temperatureC = -18.5 + random();
  const message = telemetryMessageSchema.parse({
    schemaVersion: 1,
    messageId: randomUUID(),
    vehicleId: state.vehicleId,
    sessionId: state.sessionId,
    sequence: state.sequence,
    recordedAt: recordedAt.toISOString(),
    location: {
      latitude: position.latitude,
      longitude: position.longitude,
    },
    speedKph,
    heading: position.heading,
    cargo: {
      temperatureC,
      doorOpen: false,
    },
  });

  return {
    message,
    nextState: {
      ...state,
      sequence: state.sequence + 1,
      routeProgress: (state.routeProgress + 0.002 + random() * 0.001) % 1,
    },
  };
}
