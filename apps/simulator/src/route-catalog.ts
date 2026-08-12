import { z } from 'zod';

import seoulBusanFixture from './route-fixtures/seoul-busan.json' with { type: 'json' };
import seoulDaejeonFixture from './route-fixtures/seoul-daejeon.json' with { type: 'json' };
import seoulIncheonFixture from './route-fixtures/seoul-incheon.json' with { type: 'json' };
import seoulUrbanLoopFixture from './route-fixtures/seoul-urban-loop.json' with { type: 'json' };
import { VEHICLE_ROUTE_IDS, type VehicleRouteId } from './route-ids.js';
import type { VehicleRoute } from './route-types.js';

const routeFixtureSchema = z.object({
  id: z.enum(VEHICLE_ROUTE_IDS),
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

export function getRouteById(routeId: VehicleRouteId): VehicleRoute {
  const route = VEHICLE_ROUTES.find(({ id }) => id === routeId);

  if (route === undefined) {
    throw new RangeError(`알 수 없는 차량 경로입니다: ${routeId}`);
  }

  return route;
}
