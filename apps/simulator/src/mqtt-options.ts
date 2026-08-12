import type { IClientOptions } from 'mqtt';

import type { SimulatorConfig } from './config.js';

const MQTT_CONNECT_TIMEOUT_MS = 10_000;
const MQTT_RECONNECT_PERIOD_MS = 1_000;

interface MqttClientIdentity {
  vehicleId: string;
  sessionId: string;
}

/** simulator 설정과 차량 identity를 MQTT v5 연결 옵션으로 변환한다. */
export function createMqttClientOptions(
  config: Pick<SimulatorConfig, 'mqttUsername' | 'mqttPassword'>,
  identity: MqttClientIdentity,
): IClientOptions {
  return {
    clean: true,
    clientId: `frost-route-${identity.vehicleId}-${identity.sessionId.slice(0, 8)}`,
    connectTimeout: MQTT_CONNECT_TIMEOUT_MS,
    protocolVersion: 5,
    reconnectPeriod: MQTT_RECONNECT_PERIOD_MS,
    ...(config.mqttUsername === undefined ? {} : { username: config.mqttUsername }),
    ...(config.mqttPassword === undefined ? {} : { password: config.mqttPassword }),
  };
}
