import { createHmac, randomBytes } from 'node:crypto';

/**
 * Fixed-size, non-evictable overflow memory for lockouts that the precise map had to
 * evict while still active (ADR-0017). It is written only on such forced evictions and
 * read only for keys that have no precise entry.
 *
 * Keys are hashed with HMAC(secret, key) into `rows` rows of `width` slots. Failure counts
 * and lockout deadlines keep the per-slot maximum and are read as the minimum across rows,
 * so collisions can only over-estimate. Counts halve every `decayMs`; deadlines expire by
 * time and expired ones are cleared at each decay step. If any row is more than
 * `saturation` occupied, reads return nothing (this layer fails open) and
 * `onSaturated` is called with a running count, leaving the precise map and the IP
 * limiters in charge.
 */
export interface SketchOptions {
  readonly rows?: number;
  readonly width?: number;
  readonly decayMs: number;
  readonly secret?: Buffer;
  /** Fraction of a row that may be occupied before reads are ignored (default 0.5). */
  readonly saturation?: number;
  readonly onSaturated?: (total: number) => void;
}

export interface SketchEstimate {
  readonly failures: number;
  readonly lockedUntil: number;
}

const NOTHING: SketchEstimate = { failures: 0, lockedUntil: 0 };

export class CountMinSketch {
  private readonly rows: number;
  private readonly width: number;
  private readonly counts: Uint32Array;
  private readonly deadlines: Float64Array;
  private readonly occupied: Uint32Array;
  private readonly secret: Buffer;
  private lastDecay: number | null = null;
  private saturatedReads = 0;

  constructor(private readonly options: SketchOptions) {
    this.rows = options.rows ?? 4;
    this.width = options.width ?? 16_384;
    this.counts = new Uint32Array(this.rows * this.width);
    this.deadlines = new Float64Array(this.rows * this.width);
    this.occupied = new Uint32Array(this.rows);
    this.secret = options.secret ?? randomBytes(32);
  }

  get saturatedReadCount(): number {
    return this.saturatedReads;
  }

  private slots(key: string): number[] {
    const digest = createHmac('sha256', this.secret).update(key).digest();
    return Array.from({ length: this.rows }, (_, row) => {
      return row * this.width + (digest.readUInt32BE(row * 4) % this.width);
    });
  }

  private decay(now: number): void {
    if (this.lastDecay === null) {
      this.lastDecay = now;
      return;
    }
    const periods = Math.floor((now - this.lastDecay) / this.options.decayMs);
    if (periods <= 0) return;
    const shift = Math.min(periods, 31);
    this.occupied.fill(0);
    for (let i = 0; i < this.counts.length; i += 1) {
      this.counts[i] = (this.counts[i] ?? 0) >>> shift;
      if ((this.deadlines[i] ?? 0) <= now) this.deadlines[i] = 0;
      if ((this.counts[i] ?? 0) > 0 || (this.deadlines[i] ?? 0) > 0) {
        const row = Math.floor(i / this.width);
        this.occupied[row] = (this.occupied[row] ?? 0) + 1;
      }
    }
    this.lastDecay += periods * this.options.decayMs;
  }

  private saturated(): boolean {
    const limit = this.width * (this.options.saturation ?? 0.5);
    return Array.from(this.occupied).some((count) => count > limit);
  }

  /** Estimate for a key with no precise entry; nothing when the sketch is saturated. */
  read(key: string, now: number): SketchEstimate {
    this.decay(now);
    if (this.saturated()) {
      this.saturatedReads += 1;
      this.options.onSaturated?.(this.saturatedReads);
      return NOTHING;
    }
    let failures = Number.MAX_SAFE_INTEGER;
    let lockedUntil = Number.MAX_SAFE_INTEGER;
    for (const slot of this.slots(key)) {
      failures = Math.min(failures, this.counts[slot] ?? 0);
      lockedUntil = Math.min(lockedUntil, this.deadlines[slot] ?? 0);
    }
    return { failures, lockedUntil };
  }

  /** Remembers an evicted active entry: raises its slots to the given estimates. */
  record(key: string, estimate: SketchEstimate, now: number): void {
    this.decay(now);
    this.slots(key).forEach((slot, row) => {
      const wasEmpty = (this.counts[slot] ?? 0) === 0 && (this.deadlines[slot] ?? 0) === 0;
      this.counts[slot] = Math.max(this.counts[slot] ?? 0, Math.min(estimate.failures, 0xffffffff));
      this.deadlines[slot] = Math.max(this.deadlines[slot] ?? 0, estimate.lockedUntil);
      if (wasEmpty) this.occupied[row] = (this.occupied[row] ?? 0) + 1;
    });
  }
}
