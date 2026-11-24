/**
 * Insertion-ordered key store with a hard size cap. Every write re-inserts the key, so
 * Map order is least-recently-touched first. Expired entries are pruned in small
 * amortised batches from the old end instead of scanning the whole map per request.
 *
 * Entries that are actively enforcing a restriction (a running lockout, or a window
 * already over its limit) are never evicted: otherwise an attacker could flood the store
 * with fresh keys to push out their own lockout. When the store is full and no inactive
 * entry can be found, a new key is refused and callers fail closed.
 */
export interface BoundedStoreOptions<V> {
  readonly maxKeys: number;
  /** True when an entry can be dropped at `now`. */
  readonly isExpired: (value: V, now: number) => boolean;
  /** True while an entry is enforcing a restriction and must not be evicted. */
  readonly isActive: (value: V, now: number) => boolean;
  /** Run a prune batch every N writes (default 256). */
  readonly pruneEvery?: number;
  /** Maximum entries inspected per prune or eviction scan (default 512). */
  readonly scanLimit?: number;
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

  /** Stores the value; returns false (and stores nothing) when no room can be made. */
  set(key: string, value: V, now: number): boolean {
    const isNew = !this.entries.has(key);
    if (isNew && this.entries.size >= this.options.maxKeys && !this.makeRoom(now)) {
      return false;
    }
    this.entries.delete(key);
    this.entries.set(key, value);
    this.writes += 1;
    if (this.writes % (this.options.pruneEvery ?? 256) === 0) this.pruneBatch(now);
    return true;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  private pruneBatch(now: number): void {
    let inspected = 0;
    const limit = this.options.scanLimit ?? 512;
    for (const [key, value] of this.entries) {
      if (inspected >= limit) break;
      inspected += 1;
      if (this.options.isExpired(value, now)) this.entries.delete(key);
    }
  }

  /** Frees one slot: expired entries first, then the oldest inactive entry. */
  private makeRoom(now: number): boolean {
    this.pruneBatch(now);
    if (this.entries.size < this.options.maxKeys) return true;
    let inspected = 0;
    const limit = this.options.scanLimit ?? 512;
    for (const [key, value] of this.entries) {
      if (inspected >= limit) break;
      inspected += 1;
      if (!this.options.isActive(value, now)) {
        this.entries.delete(key);
        return true;
      }
    }
    return false;
  }
}
