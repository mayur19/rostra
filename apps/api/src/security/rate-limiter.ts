/**
 * Fixed-window attempt counter for login throttling (ADR-0006). In-process by design:
 * the API runs as a single instance per host; a shared store is a pending hardening item.
 */
export interface RateLimiter {
  /** Records an attempt; returns seconds to wait when the key is over the limit, else 0. */
  hit(key: string, now?: number): number;
  reset(key: string): void;
}

export function createRateLimiter(max: number, windowMs: number, maxKeys = 50_000): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  const prune = (now: number) => {
    for (const [key, value] of windows) {
      if (now - value.start >= windowMs) windows.delete(key);
    }
  };

  return {
    hit(key, now = Date.now()) {
      if (windows.size >= maxKeys) prune(now);
      const current = windows.get(key);
      const window =
        !current || now - current.start >= windowMs ? { start: now, count: 0 } : current;
      const next = { start: window.start, count: window.count + 1 };
      windows.set(key, next);
      return next.count > max ? Math.ceil((next.start + windowMs - now) / 1000) : 0;
    },
    reset(key) {
      windows.delete(key);
    },
  };
}

/**
 * Per-key progressive backoff for failed logins: the first `freeAttempts` failures are
 * free, then each further failure locks the key for base * 2^(n - freeAttempts) ms,
 * capped at `maxDelayMs`. The cap bounds how long an attacker can lock out a victim.
 */
export interface BackoffLimiter {
  /** Seconds the key must still wait, or 0 when an attempt is allowed. */
  check(key: string, now?: number): number;
  fail(key: string, now?: number): void;
  reset(key: string): void;
}

export interface BackoffOptions {
  readonly freeAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly maxKeys?: number;
}

export function createBackoffLimiter(options: BackoffOptions): BackoffLimiter {
  const maxKeys = options.maxKeys ?? 50_000;
  const state = new Map<string, { failures: number; lockedUntil: number; lastFailure: number }>();
  // Failure history is forgotten once a key has been quiet for twice the maximum delay.
  const forgetAfter = options.maxDelayMs * 2;

  const prune = (now: number) => {
    for (const [key, value] of state) {
      if (now - value.lastFailure >= forgetAfter) state.delete(key);
    }
  };

  return {
    check(key, now = Date.now()) {
      const entry = state.get(key);
      if (!entry) return 0;
      if (now - entry.lastFailure >= forgetAfter) {
        state.delete(key);
        return 0;
      }
      return entry.lockedUntil > now ? Math.ceil((entry.lockedUntil - now) / 1000) : 0;
    },
    fail(key, now = Date.now()) {
      if (state.size >= maxKeys) prune(now);
      const previous = state.get(key);
      const failures =
        previous && now - previous.lastFailure < forgetAfter ? previous.failures + 1 : 1;
      const excess = failures - options.freeAttempts;
      const delay =
        excess > 0 ? Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (excess - 1)) : 0;
      state.set(key, { failures, lockedUntil: now + delay, lastFailure: now });
    },
    reset(key) {
      state.delete(key);
    },
  };
}
