import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createPool } from './db/pool.js';
import { createLogger } from './logger.js';
import { createRateLimiter } from './security/rate-limiter.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createPool(config.DATABASE_URL);
  const app = await buildApp({
    config,
    db,
    logger,
    loginLimiter: createRateLimiter(config.LOGIN_RATE_LIMIT_MAX, config.LOGIN_RATE_LIMIT_WINDOW_MS),
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await db.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
