import { describe, expect, it } from 'vitest';
import { generateWardProblem, solve, MAX_ITERATIONS, type ProblemInput } from '../src/index.js';
import { CONTRACT, employee, problem, shift } from './helpers.js';

const ward = generateWardProblem({ seed: 11, employees: 20 });

describe('solve', () => {
  it('is deterministic for a given seed and iteration budget', () => {
    const a = solve(ward, { seed: 5, iterations: 5000 });
    const b = solve(ward, { seed: 5, iterations: 5000 });
    expect(a.assignments).toEqual(b.assignments);
    expect(a.evaluation).toEqual(b.evaluation);
    expect({ ...a.stats, elapsedMs: 0 }).toEqual({ ...b.stats, elapsedMs: 0 });
  });

  it('explores differently under different seeds', () => {
    const a = solve(ward, { seed: 1, iterations: 2000 });
    const b = solve(ward, { seed: 2, iterations: 2000 });
    expect(a.assignments).not.toEqual(b.assignments);
  });

  it('finds a fully staffed, hard-feasible ward roster', () => {
    const result = solve(ward, { seed: 42, iterations: 20_000 });
    expect(result.evaluation.feasible).toBe(true);
    expect(result.evaluation.metrics.coverageRatio).toBe(1);
  });

  it('never ends worse than the greedy construction', () => {
    for (const seed of [1, 2, 3, 4]) {
      const result = solve(ward, { seed, iterations: 4000 });
      const { greedyScore, finalScore } = result.stats;
      expect(finalScore.hard).toBeLessThanOrEqual(greedyScore.hard);
      if (finalScore.hard === greedyScore.hard) {
        expect(finalScore.soft).toBeLessThanOrEqual(greedyScore.soft);
      }
    }
  });

  it('improves soft score through annealing on a tight instance', () => {
    const tight = generateWardProblem({ seed: 7, employees: 18 });
    const result = solve(tight, { seed: 42, iterations: 20_000 });
    expect(result.evaluation.score.soft).toBeLessThan(result.stats.greedyScore.soft);
    expect(result.stats.improvements).toBeGreaterThan(0);
  });

  it('keeps pinned assignments even when they violate rules', () => {
    const input: ProblemInput = problem(
      [employee('a', { skills: [] }), employee('b')],
      [shift('s1', 0, 8, 8), shift('s2', 1, 8, 8)],
      { pinned: [{ shiftId: 's1', employeeId: 'a' }] },
    );
    const result = solve(input, { seed: 1, iterations: 500 });
    expect(result.assignments).toContainEqual({ shiftId: 's1', employeeId: 'a' });
    expect(result.evaluation.violations.map((v) => v.constraint)).toContain('SKILL_MISSING');
  });

  it('leaves impossible slots unfilled and explains why', () => {
    const input = problem([employee('a')], [shift('icu', 0, 8, 8, { skill: 'ICU' })]);
    const result = solve(input, { seed: 1, iterations: 1000 });
    expect(result.assignments).toEqual([]);
    expect(result.evaluation.violations[0]).toMatchObject({
      constraint: 'UNFILLED_SLOT',
      shiftIds: ['icu'],
    });
  });

  it('escapes a greedy trap where the most flexible worker is taken first', () => {
    // Two overlapping shifts: only "flex" can do ICU, both can do RN.
    const input = problem(
      [
        employee('flex', {
          skills: [
            { skill: 'RN', expiresOn: null },
            { skill: 'ICU', expiresOn: null },
          ],
        }),
        employee('rn'),
      ],
      [shift('ward', 0, 8, 8), shift('icu', 0, 8, 8, { skill: 'ICU' })],
    );
    const result = solve(input, { seed: 3, iterations: 2000 });
    expect(result.evaluation.feasible).toBe(true);
    expect(result.assignments).toEqual(
      expect.arrayContaining([
        { shiftId: 'ward', employeeId: 'rn' },
        { shiftId: 'icu', employeeId: 'flex' },
      ]),
    );
  });

  it('respects rest and consecutive-day contracts across the week', () => {
    const contract = { ...CONTRACT, minRestHours: 12, maxConsecutiveDays: 3 };
    const staff = ['a', 'b', 'c'].map((id) => employee(id, { contract }));
    const shifts = [0, 1, 2, 3, 4, 5, 6].flatMap((d) => [
      shift(`d${d}`, d, 7, 8),
      shift(`n${d}`, d, 19, 8),
    ]);
    const result = solve(problem(staff, shifts), { seed: 9, iterations: 20_000 });
    expect(result.evaluation.feasible).toBe(true);
  });

  it('accepts a warm start and zero iterations', () => {
    const input = problem([employee('a'), employee('b')], [shift('s', 0, 8, 8)]);
    const result = solve(input, {
      seed: 1,
      iterations: 0,
      warmStart: [{ shiftId: 's', employeeId: 'b' }],
    });
    expect(result.assignments).toEqual([{ shiftId: 's', employeeId: 'b' }]);
    expect(result.stats.iterations).toBe(0);
  });

  it('caps the iteration budget', () => {
    const input = problem([], []);
    const result = solve(input, { seed: 1, iterations: MAX_ITERATIONS * 10 });
    expect(result.stats.iterations).toBe(0);
    expect(result.evaluation.score).toEqual({ hard: 0, soft: 0 });
  });

  it('solves a 160-person, 544-slot week within the performance budget', () => {
    const large = generateWardProblem({ seed: 7, employees: 160, demandScale: 8 });
    const result = solve(large, { seed: 42, iterations: 50_000 });
    expect(result.evaluation.metrics.slotsTotal).toBe(544);
    expect(result.evaluation.feasible).toBe(true);
    expect(result.stats.elapsedMs).toBeLessThan(5000);
  });
});
