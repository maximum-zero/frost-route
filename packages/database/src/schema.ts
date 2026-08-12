import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid().defaultRandom().primaryKey(),
    code: varchar({ length: 32 }).notNull(),
    licensePlate: varchar('license_plate', { length: 32 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    temperatureMinC: numeric('temperature_min_c', { precision: 5, scale: 2 }).notNull(),
    temperatureMaxC: numeric('temperature_max_c', { precision: 5, scale: 2 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_vehicles_code').on(table.code),
    unique('uq_vehicles_license_plate').on(table.licensePlate),
    check(
      'chk_vehicles_temperature_range',
      sql`${table.temperatureMinC} < ${table.temperatureMaxC}`,
    ),
  ],
);

export const ingestedMessages = pgTable(
  'ingested_messages',
  {
    messageId: uuid('message_id').primaryKey(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    sessionId: uuid('session_id').notNull(),
    sequence: bigint({ mode: 'bigint' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    unique('uq_ingested_messages_vehicle_session_sequence').on(
      table.vehicleId,
      table.sessionId,
      table.sequence,
    ),
    index('idx_ingested_messages_received_at').on(table.receivedAt),
    check('chk_ingested_messages_sequence', sql`${table.sequence} >= 0`),
  ],
);

export const vehicleTelemetry = pgTable(
  'vehicle_telemetry',
  {
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull(),
    messageId: uuid('message_id').notNull(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    sessionId: uuid('session_id').notNull(),
    sequence: bigint({ mode: 'bigint' }).notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    speedKph: numeric('speed_kph', { precision: 6, scale: 2 }).notNull(),
    heading: numeric({ precision: 6, scale: 2 }).notNull(),
    temperatureC: numeric('temperature_c', { precision: 5, scale: 2 }).notNull(),
    doorOpen: boolean('door_open').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'pk_vehicle_telemetry_recorded_message',
      columns: [table.recordedAt, table.messageId],
    }),
    index('idx_vehicle_telemetry_vehicle_recorded_at').on(table.vehicleId, table.recordedAt.desc()),
    check('chk_vehicle_telemetry_sequence', sql`${table.sequence} >= 0`),
    check(
      'chk_vehicle_telemetry_latitude',
      sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`,
    ),
    check(
      'chk_vehicle_telemetry_longitude',
      sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`,
    ),
    check('chk_vehicle_telemetry_speed', sql`${table.speedKph} >= 0 AND ${table.speedKph} <= 200`),
    check('chk_vehicle_telemetry_heading', sql`${table.heading} >= 0 AND ${table.heading} < 360`),
    check(
      'chk_vehicle_telemetry_temperature',
      sql`${table.temperatureC} >= -50 AND ${table.temperatureC} <= 50`,
    ),
  ],
);

export const vehicleLatestStates = pgTable(
  'vehicle_latest_states',
  {
    vehicleId: uuid('vehicle_id')
      .primaryKey()
      .references(() => vehicles.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull(),
    sessionId: uuid('session_id').notNull(),
    sequence: bigint({ mode: 'bigint' }).notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    speedKph: numeric('speed_kph', { precision: 6, scale: 2 }).notNull(),
    heading: numeric({ precision: 6, scale: 2 }).notNull(),
    temperatureC: numeric('temperature_c', { precision: 5, scale: 2 }).notNull(),
    doorOpen: boolean('door_open').notNull(),
    connectionStatus: varchar('connection_status', { length: 16 }).notNull(),
    temperatureStatus: varchar('temperature_status', { length: 16 }).notNull(),
    lastLiveReceivedAt: timestamp('last_live_received_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_vehicle_latest_states_recorded_at').on(table.recordedAt.desc()),
    check('chk_vehicle_latest_states_sequence', sql`${table.sequence} >= 0`),
    check(
      'chk_vehicle_latest_states_latitude',
      sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`,
    ),
    check(
      'chk_vehicle_latest_states_longitude',
      sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`,
    ),
    check(
      'chk_vehicle_latest_states_speed',
      sql`${table.speedKph} >= 0 AND ${table.speedKph} <= 200`,
    ),
    check(
      'chk_vehicle_latest_states_heading',
      sql`${table.heading} >= 0 AND ${table.heading} < 360`,
    ),
    check(
      'chk_vehicle_latest_states_temperature',
      sql`${table.temperatureC} >= -50 AND ${table.temperatureC} <= 50`,
    ),
    check(
      'chk_vehicle_latest_states_connection_status',
      sql`${table.connectionStatus} IN ('ONLINE', 'OFFLINE')`,
    ),
    check(
      'chk_vehicle_latest_states_temperature_status',
      sql`${table.temperatureStatus} IN ('NORMAL', 'ALERT')`,
    ),
  ],
);
