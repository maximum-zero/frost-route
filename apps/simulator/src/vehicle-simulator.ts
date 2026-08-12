import { randomUUID } from 'node:crypto';

import { telemetryMessageSchema, type TelemetryMessage } from '@frost-route/contracts';

import { getRouteById } from './route-catalog.js';
import { getRouteTravelLengthMeters, locateRoutePosition } from './route-geometry.js';
import type { VehicleRouteId } from './route-ids.js';
import { hashToUnitInterval, selectRouteForVehicle } from './route-selection.js';
import { MAX_VEHICLE_NUMBER, MIN_VEHICLE_NUMBER } from './simulator-constants.js';

export interface VehicleSimulationState {
  vehicleId: string;
  sessionId: string;
  sequence: number;
  routeId: VehicleRouteId;
  distanceAlongRouteMeters: number;
}

/** 차량 번호에 대응하는 session, 경로와 분산된 초기 위치를 만든다. */
export function createVehicleState(
  vehicleNumber: number,
  randomSeed: number,
  requestedRouteId?: VehicleRouteId,
): VehicleSimulationState {
  if (
    !Number.isInteger(vehicleNumber) ||
    vehicleNumber < MIN_VEHICLE_NUMBER ||
    vehicleNumber > MAX_VEHICLE_NUMBER
  ) {
    throw new RangeError(
      `차량 번호는 ${String(MIN_VEHICLE_NUMBER)}~${String(MAX_VEHICLE_NUMBER)} 사이 정수여야 합니다.`,
    );
  }
  const vehicleId = `VH-${vehicleNumber.toString().padStart(3, '0')}`;
  const route = selectRouteForVehicle(vehicleId, randomSeed, requestedRouteId);

  return {
    vehicleId,
    sessionId: randomUUID(),
    sequence: 0,
    routeId: route.id,
    distanceAlongRouteMeters:
      getRouteTravelLengthMeters(route) *
      hashToUnitInterval(`${vehicleId}:${String(randomSeed)}:initial-position`),
  };
}

/** 현재 차량 상태에서 다음 정상 주행 telemetry와 갱신 상태를 생성한다. */
export function createNextTelemetry(
  state: VehicleSimulationState,
  recordedAt: Date,
  random: () => number,
  elapsedMs: number,
): { message: TelemetryMessage; nextState: VehicleSimulationState } {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new RangeError('경과 시간은 0보다 큰 유한한 숫자여야 합니다.');
  }

  const route = getRouteById(state.routeId);
  const position = locateRoutePosition(route, state.distanceAlongRouteMeters);
  const speedKph =
    route.speedRangeKph.min + random() * (route.speedRangeKph.max - route.speedRangeKph.min);
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
  const movedDistanceMeters = (speedKph / 3.6) * (elapsedMs / 1_000);

  return {
    message,
    nextState: {
      ...state,
      sequence: state.sequence + 1,
      distanceAlongRouteMeters: state.distanceAlongRouteMeters + movedDistanceMeters,
    },
  };
}
