CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(32) NOT NULL,
  license_plate varchar(32) NOT NULL,
  name varchar(100) NOT NULL,
  temperature_min_c numeric(5, 2) NOT NULL,
  temperature_max_c numeric(5, 2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vehicles_code UNIQUE (code),
  CONSTRAINT uq_vehicles_license_plate UNIQUE (license_plate),
  CONSTRAINT chk_vehicles_temperature_range
    CHECK (temperature_min_c < temperature_max_c)
);

CREATE TABLE ingested_messages (
  message_id uuid PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  session_id uuid NOT NULL,
  sequence bigint NOT NULL,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  CONSTRAINT uq_ingested_messages_vehicle_session_sequence
    UNIQUE (vehicle_id, session_id, sequence),
  CONSTRAINT chk_ingested_messages_sequence CHECK (sequence >= 0)
);

CREATE INDEX idx_ingested_messages_received_at
  ON ingested_messages (received_at);

CREATE TABLE vehicle_telemetry (
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  message_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  session_id uuid NOT NULL,
  sequence bigint NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed_kph numeric(6, 2) NOT NULL,
  heading numeric(6, 2) NOT NULL,
  temperature_c numeric(5, 2) NOT NULL,
  door_open boolean NOT NULL,
  CONSTRAINT pk_vehicle_telemetry_recorded_message
    PRIMARY KEY (recorded_at, message_id),
  CONSTRAINT chk_vehicle_telemetry_sequence CHECK (sequence >= 0),
  CONSTRAINT chk_vehicle_telemetry_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_vehicle_telemetry_longitude CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_vehicle_telemetry_speed CHECK (speed_kph BETWEEN 0 AND 200),
  CONSTRAINT chk_vehicle_telemetry_heading CHECK (heading >= 0 AND heading < 360),
  CONSTRAINT chk_vehicle_telemetry_temperature CHECK (temperature_c BETWEEN -50 AND 50)
);

SELECT create_hypertable(
  'vehicle_telemetry',
  by_range('recorded_at', INTERVAL '1 day'),
  if_not_exists => true
);

CREATE INDEX idx_vehicle_telemetry_vehicle_recorded_at
  ON vehicle_telemetry (vehicle_id, recorded_at DESC);

CREATE TABLE vehicle_latest_states (
  vehicle_id uuid PRIMARY KEY REFERENCES vehicles(id),
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  session_id uuid NOT NULL,
  sequence bigint NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed_kph numeric(6, 2) NOT NULL,
  heading numeric(6, 2) NOT NULL,
  temperature_c numeric(5, 2) NOT NULL,
  door_open boolean NOT NULL,
  connection_status varchar(16) NOT NULL,
  temperature_status varchar(16) NOT NULL,
  last_live_received_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_vehicle_latest_states_sequence CHECK (sequence >= 0),
  CONSTRAINT chk_vehicle_latest_states_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_vehicle_latest_states_longitude CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_vehicle_latest_states_speed CHECK (speed_kph BETWEEN 0 AND 200),
  CONSTRAINT chk_vehicle_latest_states_heading CHECK (heading >= 0 AND heading < 360),
  CONSTRAINT chk_vehicle_latest_states_temperature CHECK (temperature_c BETWEEN -50 AND 50),
  CONSTRAINT chk_vehicle_latest_states_connection_status
    CHECK (connection_status IN ('ONLINE', 'OFFLINE')),
  CONSTRAINT chk_vehicle_latest_states_temperature_status
    CHECK (temperature_status IN ('NORMAL', 'ALERT'))
);

CREATE INDEX idx_vehicle_latest_states_recorded_at
  ON vehicle_latest_states (recorded_at DESC);

INSERT INTO vehicles (
  code,
  license_plate,
  name,
  temperature_min_c,
  temperature_max_c
)
SELECT
  'VH-' || lpad(vehicle_number::text, 3, '0'),
  'TEST-' || lpad(vehicle_number::text, 3, '0'),
  '테스트 차량 ' || lpad(vehicle_number::text, 3, '0'),
  -20.00,
  -15.00
FROM generate_series(1, 100) AS vehicle_number;
