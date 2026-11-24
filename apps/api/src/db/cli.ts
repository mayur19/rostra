import { loadConfig } from '../config/env.js';
import { createLogger } from '../logger.js';
import { runMigrations } from './migrate.js';
import { createPool } from './pool.js';
import { seed } from './seed.js';

async function main(command: string | undefined): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createPool(config.DATABASE_URL);
  try {
    if (command === 'migrate') {
      const applied = await runMigrations(db, logger);
      logger.info({ applied: applied.length }, 'migrations complete');
    } else if (command === 'seed') {
      await seed(db, logger);
    } else if (command === 'reset') {
      if (config.NODE_ENV === 'production')
        throw new Error('Refusing to reset a production database');
      await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await runMigrations(db, logger);
      await seed(db, logger);
    } else {
      throw new Error('Usage: cli.ts <migrate|seed|reset>');
    }
  } finally {
    await db.end();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
