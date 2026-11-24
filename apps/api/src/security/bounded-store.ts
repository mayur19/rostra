/**
 * Key store with a hard size cap for in-process throttles (ADR-0006).
 *
 * - A resumable sweep cursor walks the whole map over successive writes, removing
 *   expired entries, so pruning is amortised and eventually visits every key.
 * - When a new key arrives at the cap, the store frees a slot by preferring an expired
 *   entry, then an inactive one (not enforcing any restriction). Only if the sampled
 *   entries are all active does it evict the active entry with the least lock time
 *   remaining, reporting it through `onForcedEviction`. New keys are never refused, so
 *   filling the store cannot lock every other user out.
 */
export interface BoundedStoreOptions<V> {
  readonly maxKeys: number;
  /** True when an entry can be dropped at `now`. */
  readonly isExpired: (value: V, now: number) => boolean;
  /** Milliseconds of restriction left (0 = inactive, safe to evict). */
  readonly remainingMs: (value: V, now: number) => number;
  /** Called after an active entry had to be evicted, with the running total and the entry. */
  readonly onForcedEviction?: (total: number, key: string, value: V) => void;
  /** Run a sweep step every N writes (default 64). */
  readonly sweepEvery?: number;
  /** Entries visited per sweep step or eviction sample (default 512). */
  readonly scanLimit?: number;
}

export class BoundedStore<V> {
  private readonly entries = new Map<string, V>();
  private cursor: Iterator<[string, V]> = this.entries.entries();
  private writes = 0;
  private forcedEvictions = 0;

  constructor(private readonly options: BoundedStoreOptions<V>) {}

  get size(): number {
    return this.entries.size;
  }

  get forcedEvictionCount(): number {
    return this.forcedEvictions;
  }

  get(key: string): V | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: V, now: number): void {
    if (!this.entries.has(key) && this.entries.size >= this.options.maxKeys) {
      this.makeRoom(now);
    }
    this.entries.set(key, value);
    this.writes += 1;
    if (this.writes % (this.options.sweepEvery ?? 64) === 0) this.sweep(now);
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  /** Visits up to `limit` entries from the resumable cursor, wrapping at the end. */
  private *walk(limit: number): Generator<[string, V]> {
    let visited = 0;
    let wrapped = false;
    while (visited < limit && this.entries.size > 0) {
      const next = this.cursor.next();
      if (next.done) {
        if (wrapped) return;
        wrapped = true;
        this.cursor = this.entries.entries();
        continue;
      }
      visited += 1;
      yield next.value;
    }
  }

  private sweep(now: number): void {
    for (const [key, value] of this.walk(this.options.scanLimit ?? 512)) {
      if (this.options.isExpired(value, now)) this.entries.delete(key);
    }
  }

  private makeRoom(now: number): void {
    let victim: { key: string; value: V; remaining: number } | null = null;
    for (const [key, value] of this.walk(this.options.scanLimit ?? 512)) {
      const remaining = this.options.isExpired(value, now)
        ? 0
        : this.options.remainingMs(value, now);
      if (remaining <= 0) {
        this.entries.delete(key);
        return;
      }
      if (!victim || remaining < victim.remaining) victim = { key, value, remaining };
    }
    if (victim) {
      this.entries.delete(victim.key);
      this.forcedEvictions += 1;
      this.options.onForcedEviction?.(this.forcedEvictions, victim.key, victim.value);
    }
  }
}
