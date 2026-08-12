import { z } from 'zod';

import seoulBusanFixture from './route-fixtures/seoul-busan.json' with { type: 'json' };
import seoulDaejeonFixture from './route-fixtures/seoul-daejeon.json' with { type: 'json' };
import seoulIncheonFixture from './route-fixtures/seoul-incheon.json' with { type: 'json' };
import seoulUrbanLoopFixture from './route-fixtures/seoul-urban-loop.json' with { type: 'json' };

const EARTH_RADIUS_METERS = 6_371_008.8;

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type RouteKind = 'LOOP' | 'OUT_AND_BACK';
export type RouteCategory = 'URBAN' | 'METRO' | 'REGIONAL' | 'LONG_HAUL';

export interface VehicleRoute {
  id: string;
  name: string;
  category: RouteCategory;
  kind: RouteKind;
  selectionWeight: number;
  speedRangeKph: {
    min: number;
    max: number;
  };
  source: string;
  points: readonly Coordinate[];
}

export interface RoutePosition extends Coordinate {
  heading: number;
}

interface RouteMetrics {
  cumulativeMeters: readonly number[];
  pathLengthMeters: number;
  travelLengthMeters: number;
}

const routeFixtureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['URBAN', 'METRO', 'REGIONAL', 'LONG_HAUL']),
  kind: z.enum(['LOOP', 'OUT_AND_BACK']),
  selectionWeight: z.number().positive(),
  speedRangeKph: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().max(200),
    })
    .refine(({ min, max }) => min < max, '경로의 최대 속도는 최소 속도보다 커야 합니다.'),
  source: z.string().min(1),
  points: z
    .array(
      z
        .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
        .transform(([latitude, longitude]) => ({ latitude, longitude })),
    )
    .min(2),
});

export const VEHICLE_ROUTES: readonly VehicleRoute[] = [
  routeFixtureSchema.parse(seoulUrbanLoopFixture),
  routeFixtureSchema.parse(seoulIncheonFixture),
  routeFixtureSchema.parse(seoulDaejeonFixture),
  routeFixtureSchema.parse(seoulBusanFixture),
];

const routeMetrics = new Map<string, RouteMetrics>();

/** vehicle ID와 seed의 안정적인 hash를 경로 가중치에 적용한다. */
export function selectRouteForVehicle(
  vehicleId: string,
  randomSeed: number,
  requestedRouteId?: string,
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

export function getRouteById(routeId: string): VehicleRoute {
  const route = VEHICLE_ROUTES.find(({ id }) => id === routeId);

  if (route === undefined) {
    throw new RangeError(`알 수 없는 차량 경로입니다: ${routeId}`);
  }

  return route;
}

/** 경로의 편도 실제 거리를 meter 단위로 반환한다. */
export function getRoutePathLengthMeters(route: VehicleRoute): number {
  return getRouteMetrics(route).pathLengthMeters;
}

/** 순환 또는 왕복을 포함한 한 운행 주기의 실제 거리를 반환한다. */
export function getRouteTravelLengthMeters(route: VehicleRoute): number {
  return getRouteMetrics(route).travelLengthMeters;
}

/** 운행 누적 거리를 도로 polyline 위 좌표와 진행 방향으로 변환한다. */
export function locateRoutePosition(
  route: VehicleRoute,
  distanceAlongRouteMeters: number,
): RoutePosition {
  if (!Number.isFinite(distanceAlongRouteMeters)) {
    throw new TypeError('경로 이동 거리는 유한한 숫자여야 합니다.');
  }

  const metrics = getRouteMetrics(route);
  const wrappedDistance = positiveModulo(distanceAlongRouteMeters, metrics.travelLengthMeters);
  const isReturning = route.kind === 'OUT_AND_BACK' && wrappedDistance > metrics.pathLengthMeters;
  const pathDistance = isReturning ? metrics.travelLengthMeters - wrappedDistance : wrappedDistance;
  const segmentIndex = findSegmentIndex(metrics.cumulativeMeters, pathDistance);
  const start = route.points[segmentIndex];
  const end = route.points[segmentIndex + 1];
  const segmentStart = metrics.cumulativeMeters[segmentIndex];
  const segmentEnd = metrics.cumulativeMeters[segmentIndex + 1];

  if (
    start === undefined ||
    end === undefined ||
    segmentStart === undefined ||
    segmentEnd === undefined
  ) {
    throw new RangeError('경로 구간을 찾을 수 없습니다.');
  }

  const segmentLength = segmentEnd - segmentStart;
  const progress = segmentLength === 0 ? 0 : (pathDistance - segmentStart) / segmentLength;
  const from = isReturning ? end : start;
  const to = isReturning ? start : end;

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    longitude: start.longitude + (end.longitude - start.longitude) * progress,
    heading: calculateHeading(from, to),
  };
}

/** 두 WGS84 좌표의 대권 거리를 meter 단위로 계산한다. */
export function calculateDistanceMeters(start: Coordinate, end: Coordinate): number {
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const latitudeDelta = endLatitude - startLatitude;
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function getRouteMetrics(route: VehicleRoute): RouteMetrics {
  const cached = routeMetrics.get(route.id);
  if (cached !== undefined) {
    return cached;
  }

  const cumulativeMeters = [0];
  for (let index = 1; index < route.points.length; index += 1) {
    const previous = route.points[index - 1];
    const current = route.points[index];
    const previousDistance = cumulativeMeters[index - 1];

    if (previous === undefined || current === undefined || previousDistance === undefined) {
      throw new RangeError('경로 거리 계산에 필요한 좌표가 없습니다.');
    }

    cumulativeMeters.push(previousDistance + calculateDistanceMeters(previous, current));
  }

  const pathLengthMeters = cumulativeMeters.at(-1);
  if (pathLengthMeters === undefined || pathLengthMeters <= 0) {
    throw new RangeError('차량 경로 길이는 0보다 커야 합니다.');
  }

  const metrics = {
    cumulativeMeters,
    pathLengthMeters,
    travelLengthMeters: route.kind === 'OUT_AND_BACK' ? pathLengthMeters * 2 : pathLengthMeters,
  } satisfies RouteMetrics;
  routeMetrics.set(route.id, metrics);
  return metrics;
}

function findSegmentIndex(cumulativeMeters: readonly number[], distanceMeters: number): number {
  let low = 0;
  let high = cumulativeMeters.length - 2;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const segmentEnd = cumulativeMeters[middle + 1];

    if (segmentEnd !== undefined && distanceMeters > segmentEnd) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function calculateHeading(start: Coordinate, end: Coordinate): number {
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);

  return positiveModulo((Math.atan2(y, x) * 180) / Math.PI, 360);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
