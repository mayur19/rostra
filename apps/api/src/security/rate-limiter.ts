import { BoundedStore } from './bounded-store.js';

/**
 * In-process authentication throttles (ADR-0006). They hold state per API process, so
 * they must move to a shared Postgres store (RO-107) before running several instances.
 * Every method is synchronous: callers reserve an attempt before their first await, so
 * concurrent requests cannot slip past a check that has not yet recorded them.
 */
export interface RateLimiter {
  /** Records an attempt; returns seconds to wait when the key is over the limit, else 0. */
  hit(key: string, now?: number): number;
  reset(key: string): void;
  readonly size: number;
}

export function createRateLimiter(max: number, windowMs: number, maxKeys = 50_000): RateLimiter {
  const store = new BoundedStore<{ start: number; count: number }>({
    maxKeys,
    isExpired: (value, now) => now - value.start >= windowMs,
  });

  return {
    hit(key, now = Date.now()) {
      const current = store.get(key);
      const window =
        !current || now - current.start >= windowMs ? { start: now, count: 0 } : current;
      const next = { start: window.start, count: window.count + 1 };
      store.set(key, next, now);
      return next.count > max ? Math.ceil((next.start + windowMs - now) / 1000) : 0;
    },
    reset(key) {
      store.delete(key);
    },
    get size() {
      return store.size;
    },
  };
}

/**
 * Per-key progressive backoff for logins. `attempt` atomically checks the lockout and
 * records the attempt as a failure (pessimistic reservation); a successful login calls
 * `reset`. The first `freeAttempts` attempts are free, then each further one locks the key
 * for base * 2^(n - freeAttempts - 1) ms, capped at `maxDelayMs` so an attacker can only
 * lock a victim out for a bounded time.
 */
export interface BackoffLimiter {
  /** Seconds the key must still wait (attempt rejected, not recorded), or 0 (recorded). */
  attempt(key: string, now?: number): number;
  reset(key: string): void;
  readonly size: number;
}

export interface BackoffOptions {
  readonly freeAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly maxKeys?: number;
}

interface BackoffEntry {
  readonly failures: number;
  readonly lockedUntil: number;
  readonly lastFailure: number;
}

export function createBackoffLimiter(options: BackoffOptions): BackoffLimiter {
  // History is forgotten once a key has been quiet for twice the maximum delay.
  const forgetAfter = options.maxDelayMs * 2;
  const store = new BoundedStore<BackoffEntry>({
    maxKeys: options.maxKeys ?? 50_000,
    isExpired: (value, now) => now - value.lastFailure >= forgetAfter,
  });

  return {
    attempt(key, now = Date.now()) {
      const existing = store.get(key);
      const previous = existing && now - existing.lastFailure < forgetAfter ? existing : undefined;
      if (previous && previous.lockedUntil > now) {
        return Math.ceil((previous.lockedUntil - now) / 1000);
      }
      const failures = (previous?.failures ?? 0) + 1;
      const excess = failures - options.freeAttempts;
      const delay =
        excess > 0 ? Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (excess - 1)) : 0;
      store.set(key, { failures, lockedUntil: now + delay, lastFailure: now }, now);
      return 0;
    },
    reset(key) {
      store.delete(key);
    },
    get size() {
      return store.size;
    },
  };
}
