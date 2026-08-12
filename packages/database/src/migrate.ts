import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Pool, PoolClient } from 'pg';

const MIGRATION_FILE_PATTERN = /^\d{8}_\d{3}_[a-z0-9_]+\.sql$/;
const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const MIGRATION_LOCK_ID = 7_359_104_283;

interface AppliedMigration {
  name: string;
  checksum: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/** package의 SQL migration을 이름순으로 transaction 단위 적용한다. */
export async function migrateDatabase(pool: Pool): Promise<MigrationResult> {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await ensureMigrationTable(client);
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => MIGRATION_FILE_PATTERN.test(name))
      .sort();
    const appliedMigrations = await readAppliedMigrations(client);
    const result: MigrationResult = { applied: [], skipped: [] };

    for (const name of migrationFiles) {
      const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = appliedMigrations.get(name);

      if (applied !== undefined) {
        if (applied !== checksum) {
          throw new Error(`이미 적용된 migration 내용이 변경되었습니다: ${name}`);
        }
        result.skipped.push(name);
        continue;
      }

      await applyMigration(client, name, checksum, sql);
      result.applied.push(name);
    }

    return result;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
    }
  }
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS frost_route_schema_migrations (
      name varchar(255) PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function readAppliedMigrations(client: PoolClient): Promise<Map<string, string>> {
  const query = await client.query<AppliedMigration>(
    'SELECT name, checksum FROM frost_route_schema_migrations ORDER BY name',
  );
  return new Map(query.rows.map(({ name, checksum }) => [name, checksum]));
}

async function applyMigration(
  client: PoolClient,
  name: string,
  checksum: string,
  migrationSql: string,
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(migrationSql);
    await client.query(
      'INSERT INTO frost_route_schema_migrations (name, checksum) VALUES ($1, $2)',
      [name, checksum],
    );
    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  }
}
