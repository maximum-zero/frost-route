import { setTimeout as delay } from 'node:timers/promises';

import { createTelemetryTopic } from '@frost-route/contracts';
import { connectAsync, type IClientOptions, type MqttClient } from 'mqtt';

import type { SimulatorConfig } from './config.js';
import { createDeterministicRandom } from './deterministic-random.js';
import { createNextTelemetry, createVehicleState } from './vehicle-simulator.js';

interface VehicleRuntime {
  client: MqttClient;
  random: () => number;
  state: ReturnType<typeof createVehicleState>;
}

/** 설정된 차량 client를 연결하고 종료 signal까지 QoS 1 telemetry를 발행한다. */
export async function runMqttPublisher(
  config: SimulatorConfig,
  signal: AbortSignal,
): Promise<void> {
  const runtimes: VehicleRuntime[] = [];

  try {
    await Promise.all(
      Array.from({ length: config.vehicleCount }, async (_, index) => {
        const state = createVehicleState(index + 1, config.randomSeed, config.routeId);
        const options: IClientOptions = {
          clean: true,
          clientId: `frost-route-${state.vehicleId}-${state.sessionId.slice(0, 8)}`,
          connectTimeout: 10_000,
          protocolVersion: 5,
          reconnectPeriod: 1_000,
          ...(config.mqttUsername === undefined ? {} : { username: config.mqttUsername }),
          ...(config.mqttPassword === undefined ? {} : { password: config.mqttPassword }),
        };
        const client = await connectAsync(config.mqttUrl, options);

        runtimes.push({
          client,
          random: createDeterministicRandom(config.randomSeed + index),
          state,
        });
      }),
    );
  } catch (error: unknown) {
    await closeClients(runtimes);
    throw error;
  }

  log('simulator_started', {
    vehicleCount: runtimes.length,
    intervalMs: config.intervalMs,
    routeProfile: config.routeProfile,
    routeDistribution: countRoutes(runtimes),
  });

  let previousTickAt = performance.now() - config.intervalMs;
  let nextTickAt = performance.now();

  try {
    while (!signal.aborted) {
      const tickAt = performance.now();
      const elapsedMs = tickAt - previousTickAt;
      previousTickAt = tickAt;
      nextTickAt += config.intervalMs;
      const recordedAt = new Date();

      await Promise.all(
        runtimes.map(async (runtime) => {
          const { message, nextState } = createNextTelemetry(
            runtime.state,
            recordedAt,
            runtime.random,
            elapsedMs,
          );
          await runtime.client.publishAsync(
            createTelemetryTopic(message.vehicleId),
            JSON.stringify(message),
            {
              qos: 1,
              retain: false,
            },
          );
          runtime.state = nextState;
        }),
      );

      log('telemetry_published', {
        count: runtimes.length,
        firstSequence: runtimes[0]?.state.sequence,
      });

      await delay(calculateRemainingDelayMs(nextTickAt, performance.now()), undefined, {
        signal,
      });
    }
  } catch (error: unknown) {
    if (!signal.aborted) {
      throw error;
    }
  } finally {
    await closeClients(runtimes);
    log('simulator_stopped', { vehicleCount: runtimes.length });
  }
}

/** 고정 tick 기준에서 처리 시간을 제외한 다음 대기 시간을 계산한다. */
export function calculateRemainingDelayMs(nextTickAt: number, currentTime: number): number {
  if (!Number.isFinite(nextTickAt) || !Number.isFinite(currentTime)) {
    throw new TypeError('tick 시간은 유한한 숫자여야 합니다.');
  }

  return Math.max(0, nextTickAt - currentTime);
}

/** 연결된 모든 MQTT client의 종료를 각각 끝까지 시도한다. */
async function closeClients(runtimes: readonly VehicleRuntime[]): Promise<void> {
  await Promise.allSettled(runtimes.map(async ({ client }) => client.endAsync()));
}

/** credential이나 전체 payload를 제외한 구조화 로그를 출력한다. */
function log(event: string, details: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'simulator',
      event,
      ...details,
    }),
  );
}

function countRoutes(runtimes: readonly VehicleRuntime[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const { state } of runtimes) {
    distribution[state.routeId] = (distribution[state.routeId] ?? 0) + 1;
  }
  return distribution;
}
