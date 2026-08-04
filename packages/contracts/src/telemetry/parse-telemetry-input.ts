import { telemetryMessageSchema, type TelemetryMessage } from './telemetry-message.js';
import { parseTelemetryTopic } from './telemetry-topic.js';

export const MAX_TELEMETRY_PAYLOAD_BYTES = 16 * 1024;

const MAX_PAST_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_OFFSET_MS = 5 * 60 * 1000;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export type TelemetryParseErrorCode =
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_TOPIC'
  | 'INVALID_UTF8'
  | 'INVALID_JSON'
  | 'INVALID_PAYLOAD'
  | 'VEHICLE_ID_MISMATCH'
  | 'INVALID_RECEIVED_AT'
  | 'RECORDED_AT_OUT_OF_RANGE';

export interface ParseTelemetryInput {
  topic: string;
  payload: Uint8Array;
  receivedAt: Date;
}

interface ParseTelemetrySuccess {
  success: true;
  message: TelemetryMessage;
}

interface ParseTelemetryFailure {
  success: false;
  code: TelemetryParseErrorCode;
}

export type ParseTelemetryResult = ParseTelemetrySuccess | ParseTelemetryFailure;

/** 검증 실패 코드를 일관된 결과 형태로 감싼다. */
function failure(code: TelemetryParseErrorCode): ParseTelemetryFailure {
  return { success: false, code };
}

/** 원시 MQTT 입력을 단계별로 검증해 안전한 텔레메트리 메시지로 변환한다. */
export function parseTelemetryInput(input: ParseTelemetryInput): ParseTelemetryResult {
  if (input.payload.byteLength > MAX_TELEMETRY_PAYLOAD_BYTES) {
    return failure('PAYLOAD_TOO_LARGE');
  }

  const topicVehicleId = parseTelemetryTopic(input.topic);
  if (topicVehicleId === null) {
    return failure('INVALID_TOPIC');
  }

  let payloadText: string;
  try {
    payloadText = UTF8_DECODER.decode(input.payload);
  } catch {
    return failure('INVALID_UTF8');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText) as unknown;
  } catch {
    return failure('INVALID_JSON');
  }

  const parsedPayload = telemetryMessageSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return failure('INVALID_PAYLOAD');
  }

  if (parsedPayload.data.vehicleId !== topicVehicleId) {
    return failure('VEHICLE_ID_MISMATCH');
  }

  const receivedAtMs = input.receivedAt.getTime();
  if (!Number.isFinite(receivedAtMs)) {
    return failure('INVALID_RECEIVED_AT');
  }

  const recordedAtMs = Date.parse(parsedPayload.data.recordedAt);
  const earliestRecordedAtMs = receivedAtMs - MAX_PAST_AGE_MS;
  const latestRecordedAtMs = receivedAtMs + MAX_FUTURE_OFFSET_MS;

  if (recordedAtMs < earliestRecordedAtMs || recordedAtMs > latestRecordedAtMs) {
    return failure('RECORDED_AT_OUT_OF_RANGE');
  }

  return { success: true, message: parsedPayload.data };
}
