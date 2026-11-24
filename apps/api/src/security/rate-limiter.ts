import { BoundedStore } from './bounded-store.js';
import { CountMinSketch, type SketchOptions } from './count-min-sketch.js';

/**
 * In-process authentication throttles (ADR-0006). They hold state per API process, so
 * they must move to a shared Postgres store (RO-107) before running several instances.
 * Every method is synchronous: callers reserve an attempt before their first await, so
 * concurrent requests cannot slip past a check that has not yet recorded them.
 */
export interface LimiterStoreOptions {
  readonly maxKeys?: number;
  readonly onForcedEviction?: (total: number) => void;
  /** Called when the overflow sketch is saturated and its lockouts are ignored. */
  readonly onSketchSaturated?: (total: number) => void;
}

export interface RateLimiter {
  /** Records an attempt; returns seconds to wait when the key is over the limit, else 0. */
  hit(key: string, now?: number): number;
  reset(key: string): void;
  readonly size: number;
}

export function createRateLimiter(
  max: number,
  windowMs: number,
  store: LimiterStoreOptions | number = {},
): RateLimiter {
  const opts = typeof store === 'number' ? { maxKeys: store } : store;
  const entries = new BoundedStore<{ start: number; count: number }>({
    maxKeys: opts.maxKeys ?? 50_000,
    onForcedEviction: opts.onForcedEviction,
    isExpired: (value, now) => now - value.start >= windowMs,
    remainingMs: (value, now) => (value.count > max ? value.start + windowMs - now : 0),
  });

  return {
    hit(key, now = Date.now()) {
      const current = entries.get(key);
      const window =
        !current || now - current.start >= windowMs ? { start: now, count: 0 } : current;
      const next = { start: window.start, count: window.count + 1 };
      entries.set(key, next, now);
      return next.count > max ? Math.ceil((next.start + windowMs - now) / 1000) : 0;
    },
    reset(key) {
      entries.delete(key);
    },
    get size() {
      return entries.size;
    },
  };
}

/**
 * Per-key progressive backoff for logins (ADR-0017). `attempt` atomically checks the
 * lockout and records the attempt as a failure (pessimistic reservation); a successful
 * login calls `reset`. The first `freeAttempts` attempts are free, then each further one
 * locks the key for base * 2^(n - freeAttempts - 1) ms, capped at `maxDelayMs`.
 *
 * Two layers: a precise bounded map (exact state, may evict under pressure) and a
 * fixed-size count-min sketch that receives only entries evicted while still active.
 * A precise entry always wins; the sketch is consulted only when a key has none, so an
 * evicted lockout stays enforced while ordinary failures never touch the sketch.
 */
export interface BackoffLimiter {
  /** Seconds the key must still wait (attempt rejected, not recorded), or 0 (recorded). */
  attempt(key: string, now?: number): number;
  reset(key: string, now?: number): void;
  readonly size: number;
}

export interface BackoffOptions extends LimiterStoreOptions {
  readonly freeAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly sketch?: Omit<SketchOptions, 'decayMs'>;
}

interface BackoffEntry {
  readonly failures: number;
  readonly lockedUntil: number;
  readonly lastFailure: number;
}

export function createBackoffLimiter(options: BackoffOptions): BackoffLimiter {
  // History is forgotten once a key has been quiet for twice the maximum delay.
  const forgetAfter = options.maxDelayMs * 2;
  const sketch = new CountMinSketch({
    ...options.sketch,
    decayMs: forgetAfter,
    onSaturated: options.onSketchSaturated,
  });
  const entries = new BoundedStore<BackoffEntry>({
    maxKeys: options.maxKeys ?? 50_000,
    onForcedEviction: (total, key, value) => {
      sketch.record(key, value, value.lastFailure);
      options.onForcedEviction?.(total);
    },
    isExpired: (value, now) => now - value.lastFailure >= forgetAfter,
    remainingMs: (value, now) => Math.max(0, value.lockedUntil - now),
  });

  function current(key: string, now: number): { failures: number; lockedUntil: number } {
    const entry = entries.get(key);
    if (entry) {
      return now - entry.lastFailure < forgetAfter ? entry : { failures: 0, lockedUntil: 0 };
    }
    return sketch.read(key, now);
  }

  return {
    attempt(key, now = Date.now()) {
      const previous = current(key, now);
      if (previous.lockedUntil > now) return Math.ceil((previous.lockedUntil - now) / 1000);
      const failures = previous.failures + 1;
      const excess = failures - options.freeAttempts;
      const delay =
        excess > 0 ? Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (excess - 1)) : 0;
      entries.set(key, { failures, lockedUntil: now + delay, lastFailure: now }, now);
      return 0;
    },
    reset(key, now = Date.now()) {
      // A precise zeroed entry overrides any sketch history for this key.
      entries.set(key, { failures: 0, lockedUntil: 0, lastFailure: now }, now);
    },
    get size() {
      return entries.size;
    },
  };
}

/**
 * Caps how many distinct secondary keys (emails) one primary key (normalised IP or IPv6
 * /64) may introduce per window, so a single source cannot flood the per-email store.
 */
export interface DistinctKeyLimiter {
  admit(primary: string, secondary: string, now?: number): number;
  readonly size: number;
}

export function createDistinctKeyLimiter(
  maxDistinct: number,
  windowMs: number,
  store: LimiterStoreOptions = {},
): DistinctKeyLimiter {
  const entries = new BoundedStore<{ start: number; keys: ReadonlySet<string> }>({
    maxKeys: store.maxKeys ?? 50_000,
    onForcedEviction: store.onForcedEviction,
    isExpired: (value, now) => now - value.start >= windowMs,
    remainingMs: (value, now) =>
      value.keys.size >= maxDistinct ? value.start + windowMs - now : 0,
  });

  return {
    admit(primary, secondary, now = Date.now()) {
      const current = entries.get(primary);
      const window =
        !current || now - current.start >= windowMs
          ? { start: now, keys: new Set<string>() }
          : current;
      if (window.keys.has(secondary)) return 0;
      if (window.keys.size >= maxDistinct) return Math.ceil((window.start + windowMs - now) / 1000);
      entries.set(
        primary,
        { start: window.start, keys: new Set([...window.keys, secondary]) },
        now,
      );
      return 0;
    },
    get size() {
      return entries.size;
    },
  };
}
