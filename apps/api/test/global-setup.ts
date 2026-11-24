import pino from 'pino';
import { runMigrations } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';
import { testDatabaseUrl } from './env.js';
import path from 'node:path';

/** Rebuilds the test schema from migrations once per test run. */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!/test/.test(new URL(url).pathname)) {
    throw new Error(`Refusing to reset non-test database ${new URL(url).pathname}`);
  }
  const db = createPool(url);
  try {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(db, pino({ level: 'silent' }), path.resolve(__dirname, '../migrations'));
  } finally {
    await db.end();
  }
}
