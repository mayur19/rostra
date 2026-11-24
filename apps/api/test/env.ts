import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/** Resolves TEST_DATABASE_URL from the environment or the repo .env file. */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envFile = path.resolve(__dirname, '../../../.env');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('TEST_DATABASE_URL='));
    if (line) return line.slice('TEST_DATABASE_URL='.length).trim();
  }
  return 'postgresql://localhost:5432/rostra_test?host=/tmp';
}
