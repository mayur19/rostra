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
