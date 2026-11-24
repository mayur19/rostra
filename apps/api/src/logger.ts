import pino, { type Logger } from 'pino';
import type { AppConfig } from './config/env.js';

export function createLogger(config: Pick<AppConfig, 'LOG_LEVEL'>): Logger {
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
        '*.password',
      ],
      censor: '[redacted]',
    },
  });
}
