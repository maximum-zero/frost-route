import type { VehicleRouteId } from './route-ids.js';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type RouteKind = 'LOOP' | 'OUT_AND_BACK';
export type RouteCategory = 'URBAN' | 'METRO' | 'REGIONAL' | 'LONG_HAUL';

export interface VehicleRoute {
  id: VehicleRouteId;
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
