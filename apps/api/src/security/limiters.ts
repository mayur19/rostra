import type { Logger } from 'pino';
import type { AppConfig } from '../config/env.js';
import {
  createBackoffLimiter,
  createDistinctKeyLimiter,
  createRateLimiter,
  type BackoffLimiter,
  type DistinctKeyLimiter,
  type LimiterStoreOptions,
  type RateLimiter,
} from './rate-limiter.js';

/**
 * Authentication throttles (ADR-0006). All counters are in-process; they must move to a
 * shared Postgres store (RO-107) before more than one API instance serves traffic.
 */
export interface AuthLimiters {
  /** Fixed window per client IP + email. */
  readonly loginPair: RateLimiter;
  /** Fixed window per client IP across all emails (password spraying). */
  readonly loginIp: RateLimiter;
  /** Distinct emails one IP (or IPv6 /64) may try per window (store flooding). */
  readonly loginIpEmails: DistinctKeyLimiter;
  /** Progressive backoff per email across all IPs (distributed guessing). */
  readonly loginEmail: BackoffLimiter;
  /** Fixed window per client IP for sign-ups. */
  readonly register: RateLimiter;
}

/** Forced evictions mean the store is saturated with active lockouts: worth a warning. */
function storeOptions(config: AppConfig, name: string, logger?: Logger): LimiterStoreOptions {
  return {
    maxKeys: config.LIMITER_MAX_KEYS,
    onForcedEviction: (total) => {
      if (total === 1 || total % 1000 === 0) {
        logger?.warn(
          { limiter: name, forcedEvictions: total },
          'rate limiter store full of active entries',
        );
      }
    },
    onSketchSaturated: (total) => {
      if (total === 1 || total % 1000 === 0) {
        logger?.error(
          { limiter: name, saturatedReads: total },
          'lockout sketch saturated; sketch lockouts ignored until it decays',
        );
      }
    },
  };
}

export function createAuthLimiters(config: AppConfig, logger?: Logger): AuthLimiters {
  const window = config.LOGIN_RATE_LIMIT_WINDOW_MS;
  return {
    loginPair: createRateLimiter(
      config.LOGIN_RATE_LIMIT_MAX,
      window,
      storeOptions(config, 'loginPair', logger),
    ),
    loginIp: createRateLimiter(
      config.LOGIN_IP_RATE_LIMIT_MAX,
      window,
      storeOptions(config, 'loginIp', logger),
    ),
    loginIpEmails: createDistinctKeyLimiter(
      config.LOGIN_IP_DISTINCT_EMAILS_MAX,
      window,
      storeOptions(config, 'loginIpEmails', logger),
    ),
    loginEmail: createBackoffLimiter({
      freeAttempts: config.LOGIN_EMAIL_FREE_ATTEMPTS,
      baseDelayMs: config.LOGIN_EMAIL_BACKOFF_BASE_MS,
      maxDelayMs: config.LOGIN_EMAIL_BACKOFF_MAX_MS,
      ...storeOptions(config, 'loginEmail', logger),
    }),
    register: createRateLimiter(
      config.REGISTER_RATE_LIMIT_MAX,
      config.REGISTER_RATE_LIMIT_WINDOW_MS,
      storeOptions(config, 'register', logger),
    ),
  };
}
