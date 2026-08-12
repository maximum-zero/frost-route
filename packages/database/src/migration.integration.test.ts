import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateDatabase } from './migrate.js';

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe;

describeWithDatabase('TimescaleDB migration', () => {
  const pool = new Pool({ connectionString: databaseUrl });

  beforeAll(async () => {
    await migrateDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('필수 테이블과 차량 seed 100대를 생성한다', async () => {
    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'vehicles',
          'ingested_messages',
          'vehicle_telemetry',
          'vehicle_latest_states'
        )
      ORDER BY table_name
    `);
    const seed = await pool.query<{ count: string; min: string; max: string }>(`
      SELECT count(*)::text, min(code), max(code) FROM vehicles
    `);

    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      'ingested_messages',
      'vehicle_latest_states',
      'vehicle_telemetry',
      'vehicles',
    ]);
    expect(seed.rows[0]).toEqual({ count: '100', min: 'VH-001', max: 'VH-100' });
  });

  it('telemetry를 1일 chunk hypertable로 생성한다', async () => {
    const hypertable = await pool.query<{ hypertable_name: string }>(`
      SELECT hypertable_name
      FROM timescaledb_information.hypertables
      WHERE hypertable_schema = 'public'
        AND hypertable_name = 'vehicle_telemetry'
    `);
    const dimension = await pool.query<{ time_interval: string }>(`
      SELECT time_interval::text
      FROM timescaledb_information.dimensions
      WHERE hypertable_schema = 'public'
        AND hypertable_name = 'vehicle_telemetry'
        AND column_name = 'recorded_at'
    `);

    expect(hypertable.rows).toEqual([{ hypertable_name: 'vehicle_telemetry' }]);
    expect(dimension.rows).toEqual([{ time_interval: '1 day' }]);
  });

  it('멱등·조회·데이터 범위 제약을 생성한다', async () => {
    const constraints = await pool.query<{ constraint_name: string }>(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND constraint_name IN (
          'uq_ingested_messages_vehicle_session_sequence',
          'pk_vehicle_telemetry_recorded_message',
          'chk_vehicle_telemetry_latitude',
          'chk_vehicle_latest_states_connection_status'
        )
      ORDER BY constraint_name
    `);
    const indexes = await pool.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_ingested_messages_received_at',
          'idx_vehicle_telemetry_vehicle_recorded_at',
          'idx_vehicle_latest_states_recorded_at'
        )
      ORDER BY indexname
    `);

    expect(constraints.rows.map(({ constraint_name }) => constraint_name)).toEqual([
      'chk_vehicle_latest_states_connection_status',
      'chk_vehicle_telemetry_latitude',
      'pk_vehicle_telemetry_recorded_message',
      'uq_ingested_messages_vehicle_session_sequence',
    ]);
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
      'idx_ingested_messages_received_at',
      'idx_vehicle_latest_states_recorded_at',
      'idx_vehicle_telemetry_vehicle_recorded_at',
    ]);
  });

  it('적용된 migration을 checksum 기준으로 다시 실행하지 않는다', async () => {
    const result = await migrateDatabase(pool);

    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(['20260813_001_create_telemetry_schema.sql']);
  });
});
