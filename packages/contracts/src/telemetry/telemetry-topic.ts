import { z } from 'zod';

export const TELEMETRY_SUBSCRIPTION_TOPIC = 'fleet/+/telemetry' as const;

export const vehicleCodeSchema = z.string().regex(/^VH-\d{3,6}$/);

export type VehicleCode = z.infer<typeof vehicleCodeSchema>;

const TELEMETRY_TOPIC_PATTERN = /^fleet\/(VH-\d{3,6})\/telemetry$/;

/** 차량 코드를 검증하고 해당 차량의 telemetry 발행 토픽을 만든다. */
export function createTelemetryTopic(vehicleId: string): string {
  return `fleet/${vehicleCodeSchema.parse(vehicleId)}/telemetry`;
}

/** telemetry 토픽에서 유효한 차량 코드를 추출한다. */
export function parseTelemetryTopic(topic: string): VehicleCode | null {
  const match = TELEMETRY_TOPIC_PATTERN.exec(topic);
  const vehicleId = match?.[1];

  if (vehicleId === undefined) {
    return null;
  }

  const result = vehicleCodeSchema.safeParse(vehicleId);
  return result.success ? result.data : null;
}
