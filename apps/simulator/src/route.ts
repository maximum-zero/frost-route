export interface Coordinate {
  latitude: number;
  longitude: number;
}

// 서울 도심의 고정된 순환 경로로 외부 지도 API 없이 재현 가능한 이동을 만든다.
export const SEOUL_ROUTE: readonly Coordinate[] = [
  { latitude: 37.5665, longitude: 126.978 },
  { latitude: 37.5704, longitude: 126.9831 },
  { latitude: 37.5686, longitude: 126.9895 },
  { latitude: 37.5638, longitude: 126.9882 },
  { latitude: 37.5612, longitude: 126.9811 },
  { latitude: 37.5665, longitude: 126.978 },
];

export interface RoutePosition extends Coordinate {
  heading: number;
}

/** 0~1 사이 진행률을 고정 경로의 보간 좌표와 진행 방향으로 변환한다. */
export function interpolateRoute(progress: number): RoutePosition {
  if (!Number.isFinite(progress)) {
    throw new TypeError('경로 진행률은 유한한 숫자여야 합니다.');
  }

  const wrappedProgress = ((progress % 1) + 1) % 1;
  const segmentCount = SEOUL_ROUTE.length - 1;
  const scaledProgress = wrappedProgress * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaledProgress), segmentCount - 1);
  const segmentProgress = scaledProgress - segmentIndex;
  const start = SEOUL_ROUTE[segmentIndex];
  const end = SEOUL_ROUTE[segmentIndex + 1];

  if (start === undefined || end === undefined) {
    throw new RangeError('고정 경로의 segment를 찾을 수 없습니다.');
  }

  const latitude = start.latitude + (end.latitude - start.latitude) * segmentProgress;
  const longitude = start.longitude + (end.longitude - start.longitude) * segmentProgress;
  const longitudeDelta = end.longitude - start.longitude;
  const latitudeDelta = end.latitude - start.latitude;
  const heading = (Math.atan2(longitudeDelta, latitudeDelta) * 180) / Math.PI;

  return {
    latitude,
    longitude,
    heading: (heading + 360) % 360,
  };
}
