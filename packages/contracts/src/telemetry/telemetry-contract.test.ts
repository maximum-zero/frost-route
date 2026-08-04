import { describe, expect, it } from 'vitest';

import { MAX_TELEMETRY_PAYLOAD_BYTES, parseTelemetryInput } from './parse-telemetry-input.js';
import { telemetryMessageSchema, type TelemetryMessage } from './telemetry-message.js';
import {
  createTelemetryTopic,
  parseTelemetryTopic,
  TELEMETRY_SUBSCRIPTION_TOPIC,
} from './telemetry-topic.js';

const RECEIVED_AT = new Date('2026-08-03T10:20:30.000Z');
const TEXT_ENCODER = new TextEncoder();

// 기본 메시지에서 필요한 필드만 바꿔 테스트 입력을 만든다.
function createMessage(overrides: Partial<TelemetryMessage> = {}): TelemetryMessage {
  return {
    schemaVersion: 1,
    messageId: '65e76b44-05e2-4f66-9133-9203fa51369e',
    vehicleId: 'VH-001',
    sessionId: 'e06829f4-f031-4e17-8106-b06721cc962c',
    sequence: 10_452,
    recordedAt: '2026-08-03T10:20:30.000Z',
    location: {
      latitude: 37.5665,
      longitude: 126.978,
    },
    speedKph: 52.4,
    heading: 128,
    cargo: {
      temperatureC: -17.8,
      doorOpen: false,
    },
    ...overrides,
  };
}

// 테스트 입력을 실제 MQTT payload와 같은 UTF-8 바이트로 변환한다.
function encodeMessage(message: unknown): Uint8Array {
  return TEXT_ENCODER.encode(JSON.stringify(message));
}

describe('텔레메트리 토픽 계약', () => {
  it('차량 텔레메트리 토픽을 생성하고 해석한다', () => {
    expect(createTelemetryTopic('VH-001')).toBe('fleet/VH-001/telemetry');
    expect(parseTelemetryTopic('fleet/VH-001/telemetry')).toBe('VH-001');
    expect(TELEMETRY_SUBSCRIPTION_TOPIC).toBe('fleet/+/telemetry');
  });

  it.each([
    'fleet/VH-1/telemetry',
    'fleet/VH-0000001/telemetry',
    'fleet/vh-001/telemetry',
    'fleet/VH-001/status',
    'other/VH-001/telemetry',
  ])('잘못된 토픽 %s을 거부한다', (topic) => {
    expect(parseTelemetryTopic(topic)).toBeNull();
  });

  it('토픽 생성 시 잘못된 차량 코드를 거부한다', () => {
    expect(() => createTelemetryTopic('VH-1')).toThrow();
  });
});

describe('텔레메트리 메시지 스키마', () => {
  it('유효한 텔레메트리 메시지를 변경하지 않고 허용한다', () => {
    const message = createMessage();
    const parsed = telemetryMessageSchema.parse(message);

    expect(parsed).toEqual(message);
    expect(message).toEqual(createMessage());
  });

  it('설계에 정의된 숫자 경계값을 허용한다', () => {
    expect(
      telemetryMessageSchema.safeParse(
        createMessage({
          location: { latitude: -90, longitude: 180 },
          speedKph: 200,
          heading: 359.999,
          cargo: { temperatureC: 50, doorOpen: true },
        }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ['스키마 버전', { schemaVersion: 2 }],
    ['메시지 UUID', { messageId: 'not-a-uuid' }],
    ['차량 코드', { vehicleId: 'TRUCK-001' }],
    ['세션 UUID', { sessionId: 'not-a-uuid' }],
    ['음수 sequence', { sequence: -1 }],
    ['소수 sequence', { sequence: 1.5 }],
    ['UTC가 아닌 시각', { recordedAt: '2026-08-03T19:20:30+09:00' }],
    ['위도', { location: { latitude: 90.1, longitude: 126.978 } }],
    ['경도', { location: { latitude: 37.5665, longitude: -180.1 } }],
    ['속도', { speedKph: 200.1 }],
    ['방향', { heading: 360 }],
    ['온도', { cargo: { temperatureC: -50.1, doorOpen: false } }],
  ])('잘못된 %s을 거부한다', (_name, overrides) => {
    expect(telemetryMessageSchema.safeParse({ ...createMessage(), ...overrides }).success).toBe(
      false,
    );
  });

  it('정의되지 않은 필드를 거부한다', () => {
    expect(telemetryMessageSchema.safeParse({ ...createMessage(), unexpected: true }).success).toBe(
      false,
    );
  });
});

describe('원시 텔레메트리 입력 해석', () => {
  it('유효한 토픽과 payload를 해석한다', () => {
    const message = createMessage();

    expect(
      parseTelemetryInput({
        topic: createTelemetryTopic(message.vehicleId),
        payload: encodeMessage(message),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: true, message });
  });

  it.each([
    ['정확히 24시간 전인', '2026-08-02T10:20:30.000Z'],
    ['정확히 5분 후인', '2026-08-03T10:25:30.000Z'],
  ])('측정 시각이 %s 메시지를 허용한다', (_name, recordedAt) => {
    const message = createMessage({ recordedAt });

    expect(
      parseTelemetryInput({
        topic: createTelemetryTopic(message.vehicleId),
        payload: encodeMessage(message),
        receivedAt: RECEIVED_AT,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['24시간보다 오래된', '2026-08-02T10:20:29.999Z'],
    ['5분보다 미래인', '2026-08-03T10:25:30.001Z'],
  ])('측정 시각이 %s 메시지를 거부한다', (_name, recordedAt) => {
    const message = createMessage({ recordedAt });

    expect(
      parseTelemetryInput({
        topic: createTelemetryTopic(message.vehicleId),
        payload: encodeMessage(message),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'RECORDED_AT_OUT_OF_RANGE' });
  });

  it('16KB를 초과한 payload를 해석 전에 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-001/telemetry',
        payload: new Uint8Array(MAX_TELEMETRY_PAYLOAD_BYTES + 1),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('잘못된 토픽을 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-1/telemetry',
        payload: encodeMessage(createMessage()),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'INVALID_TOPIC' });
  });

  it('잘못된 UTF-8을 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-001/telemetry',
        payload: Uint8Array.from([0xc3, 0x28]),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'INVALID_UTF8' });
  });

  it('잘못된 JSON을 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-001/telemetry',
        payload: TEXT_ENCODER.encode('{'),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'INVALID_JSON' });
  });

  it('스키마를 위반한 payload를 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-001/telemetry',
        payload: encodeMessage({ ...createMessage(), sequence: -1 }),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'INVALID_PAYLOAD' });
  });

  it('토픽과 payload의 차량 코드 불일치를 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-002/telemetry',
        payload: encodeMessage(createMessage()),
        receivedAt: RECEIVED_AT,
      }),
    ).toEqual({ success: false, code: 'VEHICLE_ID_MISMATCH' });
  });

  it('잘못된 수신 시각을 거부한다', () => {
    expect(
      parseTelemetryInput({
        topic: 'fleet/VH-001/telemetry',
        payload: encodeMessage(createMessage()),
        receivedAt: new Date(Number.NaN),
      }),
    ).toEqual({ success: false, code: 'INVALID_RECEIVED_AT' });
  });
});
