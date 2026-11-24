import { describe, expect, it } from 'vitest';
import { createRng, shuffled } from '../src/index.js';

describe('createRng', () => {
  it('is reproducible for a seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('differs between seeds and stays within range', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
    for (let i = 0; i < 1000; i += 1) {
      const n = a.int(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });

  it('shuffles into a new permutation without mutating input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffled(createRng(9), input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
    expect(shuffled(createRng(9), input)).toEqual(out);
  });
});
