import { z } from 'zod';

import { vehicleCodeSchema } from './telemetry-topic.js';

const utcDateTimeSchema = z.iso.datetime({ offset: false });

const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

const cargoSchema = z
  .object({
    temperatureC: z.number().min(-50).max(50),
    doorOpen: z.boolean(),
  })
  .strict();

/** MQTT로 전달되는 텔레메트리 payload의 형식과 값 범위를 검증한다. */
export const telemetryMessageSchema = z
  .object({
    schemaVersion: z.literal(1),
    messageId: z.uuid(),
    vehicleId: vehicleCodeSchema,
    sessionId: z.uuid(),
    sequence: z.number().int().nonnegative(),
    recordedAt: utcDateTimeSchema,
    location: locationSchema,
    speedKph: z.number().min(0).max(200),
    heading: z.number().min(0).lt(360),
    cargo: cargoSchema,
  })
  .strict();

export type TelemetryMessage = z.infer<typeof telemetryMessageSchema>;
