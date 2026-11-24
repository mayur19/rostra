import { describe, expect, it } from 'vitest';
import {
  HARD_MULTIPLIER,
  SearchState,
  compileProblem,
  createRng,
  evaluateSolution,
  generateWardProblem,
} from '../src/index.js';

describe('SearchState incremental scoring', () => {
  const compiled = compileProblem(generateWardProblem({ seed: 3, employees: 14 }));

  it('starts from the full evaluation of the initial assignment', () => {
    const initial = new Int32Array(compiled.slots.length).fill(-1);
    const state = new SearchState(compiled, initial);
    const full = evaluateSolution(compiled, initial);
    expect({ hard: state.hard(), soft: state.soft() }).toEqual(full.score);
  });

  it('matches a full re-evaluation after thousands of random moves', () => {
    const rng = createRng(77);
    const state = new SearchState(compiled, new Int32Array(compiled.slots.length).fill(-1));
    for (let i = 0; i < 3000; i += 1) {
      const slot = rng.int(compiled.slots.length);
      const employee = rng.int(compiled.employees.length + 1) - 1;
      state.assign(slot, employee);
      if (i % 250 === 0) {
        const full = evaluateSolution(compiled, state.assignment);
        expect(state.hard()).toBe(full.score.hard);
        expect(Math.abs(state.soft() - full.score.soft)).toBeLessThanOrEqual(1);
      }
    }
    const full = evaluateSolution(compiled, state.assignment);
    expect(state.total()).toBeCloseTo(full.score.hard * HARD_MULTIPLIER + full.score.soft, -1);
  });

  it('treats re-assigning the same employee as a no-op and snapshots by copy', () => {
    const state = new SearchState(compiled, new Int32Array(compiled.slots.length).fill(-1));
    state.assign(0, 0);
    const before = state.total();
    state.assign(0, 0);
    expect(state.total()).toBe(before);
    const snap = state.snapshot();
    state.assign(0, -1);
    expect(snap[0]).toBe(0);
    expect(state.employeeOf(0)).toBe(-1);
  });
});
