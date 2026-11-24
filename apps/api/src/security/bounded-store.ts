/**
 * Insertion-ordered key store with a hard size cap. Every write re-inserts the key, so
 * Map order is least-recently-touched first. Expired entries are pruned in small
 * amortised batches from the old end instead of scanning the whole map per request,
 * and once the cap is reached the oldest entries are evicted.
 */
export interface BoundedStoreOptions<V> {
  readonly maxKeys: number;
  /** True when an entry can be dropped at `now`. */
  readonly isExpired: (value: V, now: number) => boolean;
  /** Run a prune batch every N writes (default 256). */
  readonly pruneEvery?: number;
  /** Maximum entries inspected per prune batch (default 512). */
  readonly pruneBatch?: number;
}

export class BoundedStore<V> {
  private readonly entries = new Map<string, V>();
  private writes = 0;

  constructor(private readonly options: BoundedStoreOptions<V>) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: V, now: number): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    this.writes += 1;
    if (this.writes % (this.options.pruneEvery ?? 256) === 0) this.pruneBatch(now);
    this.evictOverflow();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  private pruneBatch(now: number): void {
    let inspected = 0;
    const limit = this.options.pruneBatch ?? 512;
    for (const [key, value] of this.entries) {
      if (inspected >= limit) break;
      inspected += 1;
      if (this.options.isExpired(value, now)) this.entries.delete(key);
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.options.maxKeys) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.entries.delete(oldest.value);
    }
  }
}
