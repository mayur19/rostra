import type { AppConfig } from '../config/env.js';
import {
  createBackoffLimiter,
  createRateLimiter,
  type BackoffLimiter,
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
  /** Progressive backoff per email across all IPs (distributed guessing). */
  readonly loginEmail: BackoffLimiter;
  /** Fixed window per client IP for sign-ups. */
  readonly register: RateLimiter;
}

export function createAuthLimiters(config: AppConfig): AuthLimiters {
  return {
    loginPair: createRateLimiter(config.LOGIN_RATE_LIMIT_MAX, config.LOGIN_RATE_LIMIT_WINDOW_MS),
    loginIp: createRateLimiter(config.LOGIN_IP_RATE_LIMIT_MAX, config.LOGIN_RATE_LIMIT_WINDOW_MS),
    loginEmail: createBackoffLimiter({
      freeAttempts: config.LOGIN_EMAIL_FREE_ATTEMPTS,
      baseDelayMs: config.LOGIN_EMAIL_BACKOFF_BASE_MS,
      maxDelayMs: config.LOGIN_EMAIL_BACKOFF_MAX_MS,
    }),
    register: createRateLimiter(
      config.REGISTER_RATE_LIMIT_MAX,
      config.REGISTER_RATE_LIMIT_WINDOW_MS,
    ),
  };
}
