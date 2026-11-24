import { createHmac, randomBytes } from 'node:crypto';

/**
 * Fixed-size, non-evictable memory of login failures and lockouts (ADR-0017).
 *
 * Keys are hashed with HMAC(secret, key) into `rows` independent rows of `width` slots.
 * - Failure counts use conservative update (each touched slot is raised to the new
 *   estimate) and are read as the minimum across rows, so they never under-count a key
 *   except through decay; collisions can only over-count.
 * - Lockout deadlines keep the maximum deadline per slot and are read as the minimum
 *   across rows: a collision can only lengthen a lockout for the keys sharing all slots.
 * - Failure counts halve every `decayMs`, so old history fades without per-key state.
 * Memory is constant (rows * width * 12 bytes) and nothing can be evicted, so flooding
 * the precise map cannot erase what the sketch remembers.
 */
export interface SketchOptions {
  readonly rows?: number;
  readonly width?: number;
  readonly decayMs: number;
  readonly secret?: Buffer;
}

export class CountMinSketch {
  private readonly rows: number;
  private readonly width: number;
  private readonly counts: Uint32Array;
  private readonly deadlines: Float64Array;
  private readonly secret: Buffer;
  private lastDecay: number | null = null;

  constructor(private readonly options: SketchOptions) {
    this.rows = options.rows ?? 4;
    this.width = options.width ?? 16_384;
    this.counts = new Uint32Array(this.rows * this.width);
    this.deadlines = new Float64Array(this.rows * this.width);
    this.secret = options.secret ?? randomBytes(32);
  }

  private slots(key: string): number[] {
    const digest = createHmac('sha256', this.secret).update(key).digest();
    return Array.from({ length: this.rows }, (_, row) => {
      const offset = (row * 4) % (digest.length - 3);
      return row * this.width + (digest.readUInt32BE(offset) % this.width);
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
    for (let i = 0; i < this.counts.length; i += 1)
      this.counts[i] = (this.counts[i] ?? 0) >>> shift;
    this.lastDecay += periods * this.options.decayMs;
  }

  /** Estimated failures and lockout deadline for a key (both upper bounds). */
  read(key: string, now: number): { failures: number; lockedUntil: number } {
    this.decay(now);
    let failures = Number.MAX_SAFE_INTEGER;
    let lockedUntil = Number.MAX_SAFE_INTEGER;
    for (const slot of this.slots(key)) {
      failures = Math.min(failures, this.counts[slot] ?? 0);
      lockedUntil = Math.min(lockedUntil, this.deadlines[slot] ?? 0);
    }
    return { failures, lockedUntil };
  }

  /** Raises the key's estimates to at least `failures` and `lockedUntil`. */
  record(key: string, failures: number, lockedUntil: number, now: number): void {
    this.decay(now);
    for (const slot of this.slots(key)) {
      this.counts[slot] = Math.max(this.counts[slot] ?? 0, Math.min(failures, 0xffffffff));
      this.deadlines[slot] = Math.max(this.deadlines[slot] ?? 0, lockedUntil);
    }
  }
}
