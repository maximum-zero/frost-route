import { getRouteById, VEHICLE_ROUTES } from './route-catalog.js';
import type { VehicleRouteId } from './route-ids.js';
import type { VehicleRoute } from './route-types.js';

/** vehicle ID와 seed의 안정적인 hash를 경로 가중치에 적용한다. */
export function selectRouteForVehicle(
  vehicleId: string,
  randomSeed: number,
  requestedRouteId?: VehicleRouteId,
): VehicleRoute {
  if (requestedRouteId !== undefined) {
    return getRouteById(requestedRouteId);
  }

  const totalWeight = VEHICLE_ROUTES.reduce((total, route) => total + route.selectionWeight, 0);
  let bucket = hashToUnitInterval(`${vehicleId}:${String(randomSeed)}:route`) * totalWeight;

  for (const route of VEHICLE_ROUTES) {
    bucket -= route.selectionWeight;
    if (bucket < 0) {
      return route;
    }
  }

  const fallback = VEHICLE_ROUTES.at(-1);
  if (fallback === undefined) {
    throw new RangeError('차량에 배정할 경로가 없습니다.');
  }
  return fallback;
}

/** 문자열 hash를 동일 입력에서 재현 가능한 0 이상 1 미만 값으로 변환한다. */
export function hashToUnitInterval(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_296;
}
