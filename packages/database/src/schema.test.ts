import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { ingestedMessages, vehicleLatestStates, vehicles, vehicleTelemetry } from './schema.js';

describe('database schema', () => {
  it('공용 테이블 이름을 고정한다', () => {
    expect(getTableConfig(vehicles).name).toBe('vehicles');
    expect(getTableConfig(ingestedMessages).name).toBe('ingested_messages');
    expect(getTableConfig(vehicleTelemetry).name).toBe('vehicle_telemetry');
    expect(getTableConfig(vehicleLatestStates).name).toBe('vehicle_latest_states');
  });

  it('telemetry index와 접수 멱등 제약을 표현한다', () => {
    const telemetryConfig = getTableConfig(vehicleTelemetry);
    const ingestedConfig = getTableConfig(ingestedMessages);

    expect(telemetryConfig.indexes.map(({ config }) => config.name)).toContain(
      'idx_vehicle_telemetry_vehicle_recorded_at',
    );
    expect(ingestedConfig.uniqueConstraints.map(({ name }) => name)).toContain(
      'uq_ingested_messages_vehicle_session_sequence',
    );
  });
});
