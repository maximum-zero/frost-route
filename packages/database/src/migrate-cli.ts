import { Pool } from 'pg';

import { migrateDatabase } from './migrate.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim() === '') {
  throw new Error('DATABASE_URL 환경 변수가 필요합니다.');
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const result = await migrateDatabase(pool);
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'database-migration',
      event: 'migration_completed',
      applied: result.applied,
      skipped: result.skipped,
    }),
  );
} finally {
  await pool.end();
}
