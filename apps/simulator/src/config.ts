import { z } from 'zod';

import { VEHICLE_ROUTES } from './route.js';

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
    MQTT_URL: mqttUrlSchema.default('mqtt://localhost:1883'),
    MQTT_USERNAME: optionalCredentialSchema,
    MQTT_PASSWORD: optionalCredentialSchema,
    SIMULATOR_VEHICLE_COUNT: z.coerce.number().int().min(1).max(100).default(1),
    SIMULATOR_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
    SIMULATOR_RANDOM_SEED: z.coerce.number().int().nonnegative().default(20_260_804),
    SIMULATOR_ROUTE_PROFILE: z.literal('mixed').default('mixed'),
    SIMULATOR_ROUTE_ID: optionalCredentialSchema,
  })
  .superRefine((config, context) => {
    if ((config.MQTT_USERNAME === undefined) !== (config.MQTT_PASSWORD === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'MQTT_USERNAME과 MQTT_PASSWORD는 함께 설정해야 합니다.',
        path: ['MQTT_USERNAME'],
      });
    }
    if (
      config.SIMULATOR_ROUTE_ID !== undefined &&
      !VEHICLE_ROUTES.some(({ id }) => id === config.SIMULATOR_ROUTE_ID)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'SIMULATOR_ROUTE_ID는 등록된 경로 ID여야 합니다.',
        path: ['SIMULATOR_ROUTE_ID'],
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
  routeProfile: 'mixed';
  routeId?: string;
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
    routeProfile: parsed.SIMULATOR_ROUTE_PROFILE,
    ...(parsed.SIMULATOR_ROUTE_ID === undefined ? {} : { routeId: parsed.SIMULATOR_ROUTE_ID }),
  };
}
