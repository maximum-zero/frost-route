export const VEHICLE_ROUTE_IDS = [
  'seoul-urban-loop',
  'seoul-incheon',
  'seoul-daejeon',
  'seoul-busan',
] as const;

export type VehicleRouteId = (typeof VEHICLE_ROUTE_IDS)[number];
