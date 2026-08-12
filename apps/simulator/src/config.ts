import { z } from 'zod';

import { VEHICLE_ROUTE_IDS, type VehicleRouteId } from './route-ids.js';
import {
  DEFAULT_RANDOM_SEED,
  MAX_VEHICLE_NUMBER,
  MIN_VEHICLE_NUMBER,
} from './simulator-constants.js';

const optionalCredentialSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const mqttUrlSchema = z
  .url()
  .refine(
    (value) => ['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(new URL(value).protocol),
    'MQTT_URL은 mqtt, mqtts, ws 또는 wss URL이어야 합니다.',
  );

const simulatorConfigSchema = z
  .object({
    MQTT_URL: mqttUrlSchema,
    MQTT_USERNAME: optionalCredentialSchema,
    MQTT_PASSWORD: optionalCredentialSchema,
    SIMULATOR_VEHICLE_COUNT: z.coerce
      .number()
      .int()
      .min(MIN_VEHICLE_NUMBER)
      .max(MAX_VEHICLE_NUMBER)
      .default(MIN_VEHICLE_NUMBER),
    SIMULATOR_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
    SIMULATOR_RANDOM_SEED: z.coerce.number().int().nonnegative().default(DEFAULT_RANDOM_SEED),
    SIMULATOR_ROUTE_ID: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(VEHICLE_ROUTE_IDS).optional(),
    ),
  })
  .superRefine((config, context) => {
    if ((config.MQTT_USERNAME === undefined) !== (config.MQTT_PASSWORD === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'MQTT_USERNAME과 MQTT_PASSWORD는 함께 설정해야 합니다.',
        path: ['MQTT_USERNAME'],
      });
    }
  });

export interface SimulatorConfig {
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  vehicleCount: number;
  intervalMs: number;
  randomSeed: number;
  routeId?: VehicleRouteId;
}

/** process 환경 변수를 simulator가 사용하는 명시적인 설정으로 변환한다. */
export function parseSimulatorConfig(environment: NodeJS.ProcessEnv): SimulatorConfig {
  const parsed = simulatorConfigSchema.parse(environment);

  return {
    mqttUrl: parsed.MQTT_URL,
    ...(parsed.MQTT_USERNAME === undefined ? {} : { mqttUsername: parsed.MQTT_USERNAME }),
    ...(parsed.MQTT_PASSWORD === undefined ? {} : { mqttPassword: parsed.MQTT_PASSWORD }),
    vehicleCount: parsed.SIMULATOR_VEHICLE_COUNT,
    intervalMs: parsed.SIMULATOR_INTERVAL_MS,
    randomSeed: parsed.SIMULATOR_RANDOM_SEED,
    ...(parsed.SIMULATOR_ROUTE_ID === undefined ? {} : { routeId: parsed.SIMULATOR_ROUTE_ID }),
  };
}
