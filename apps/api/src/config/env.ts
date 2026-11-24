import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/**
 * TRUST_PROXY: `false` (default), a hop count such as `1`, or comma-separated proxy
 * IPs/CIDRs. `true` (trust every X-Forwarded-For) is rejected because it lets clients
 * spoof their address and evade per-IP rate limits.
 */
export type TrustProxy = false | number | string[];

const IP_OR_CIDR = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

export const trustProxySchema = z
  .string()
  .default('false')
  .transform((raw, ctx): TrustProxy => {
    const value = raw.trim();
    if (value === '' || value === 'false') return false;
    if (/^\d+$/.test(value)) return Number(value);
    const entries = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (value === 'true' || entries.some((entry) => !IP_OR_CIDR.test(entry))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TRUST_PROXY must be false, a hop count, or a list of proxy IPs/CIDRs',
      });
      return z.NEVER;
    }
    return entries;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4108),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  APP_ORIGIN: z.string().url().default('http://localhost:5108'),
  COOKIE_SECURE: booleanString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(15 * 60 * 1000),
  LOGIN_IP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(50),
  LOGIN_EMAIL_FREE_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  LOGIN_EMAIL_BACKOFF_BASE_MS: z.coerce.number().int().min(100).default(30_000),
  LOGIN_EMAIL_BACKOFF_MAX_MS: z.coerce
    .number()
    .int()
    .min(100)
    .default(60 * 60 * 1000),
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(60 * 60 * 1000),
  TRUST_PROXY: trustProxySchema,
  SOLVER_MAX_ITERATIONS: z.coerce.number().int().min(0).default(200_000),
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Parses and validates configuration; fails fast with every problem listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid configuration: ${details}`);
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.COOKIE_SECURE) {
    throw new ConfigError('Invalid configuration: COOKIE_SECURE must be true in production');
  }
  return parsed.data;
}
