import { describe, expect, it } from 'vitest';
import {
  CONSTRAINTS,
  DEFAULT_WEIGHTS,
  ProblemValidationError,
  compileProblem,
  evaluateAssignments,
  evaluateSolution,
  fromSlotAssignment,
  resolveWeights,
  toSlotAssignment,
  type ConstraintId,
  type EmployeeInput,
  type ShiftInput,
} from '../src/index.js';
import { CONTRACT, employee, problem, shift } from './helpers.js';

function evaluate(employees: EmployeeInput[], shifts: ShiftInput[], pairs: [string, string][]) {
  return evaluateAssignments(
    problem(employees, shifts),
    pairs.map(([shiftId, employeeId]) => ({ shiftId, employeeId })),
  );
}

function ids(evaluation: ReturnType<typeof evaluate>): ConstraintId[] {
  return evaluation.violations.map((v) => v.constraint);
}

describe('evaluateSolution', () => {
  it('scores an empty week with no shifts as perfect', () => {
    const result = evaluate([employee('a')], [], []);
    expect(result.score).toEqual({ hard: 0, soft: 0 });
    expect(result.feasible).toBe(true);
    expect(result.metrics.coverageRatio).toBe(1);
  });

  it('penalises unfilled slots per missing head', () => {
    const result = evaluate([employee('a')], [shift('s', 0, 8, 8, { headcount: 3 })], [['s', 'a']]);
    expect(result.violations[0]).toMatchObject({
      constraint: 'UNFILLED_SLOT',
      penalty: 20,
      shiftIds: ['s'],
    });
    expect(result.violations[0]?.message).toBe('s needs 2 more RN staff');
    expect(result.feasible).toBe(false);
    expect(result.metrics).toMatchObject({ slotsTotal: 3, slotsFilled: 1 });
  });

  it('flags missing, expired and unavailable assignments', () => {
    const result = evaluate(
      [
        employee('cna', { skills: [{ skill: 'CNA', expiresOn: null }] }),
        employee('old', { skills: [{ skill: 'RN', expiresOn: '2026-03-01' }] }),
        employee('off', {
          unavailability: [
            { start: '2026-03-02T00:00:00Z', end: '2026-03-03T00:00:00Z', reason: 'time_off' },
          ],
        }),
      ],
      [shift('s1', 0, 8, 8), shift('s2', 0, 8, 8), shift('s3', 0, 8, 8)],
      [
        ['s1', 'cna'],
        ['s2', 'old'],
        ['s3', 'off'],
      ],
    );
    expect(ids(result).sort()).toEqual(['SKILL_EXPIRED', 'SKILL_MISSING', 'UNAVAILABLE']);
    expect(result.score.hard).toBe(30);
    expect(result.violations.find((v) => v.constraint === 'SKILL_MISSING')?.message).toBe(
      'CNA lacks the RN skill required by s1',
    );
  });

  it('detects double booking including two heads of the same shift', () => {
    const overlap = evaluate(
      [employee('a')],
      [shift('s1', 0, 8, 8), shift('s2', 0, 12, 8)],
      [
        ['s1', 'a'],
        ['s2', 'a'],
      ],
    );
    expect(ids(overlap)).toEqual(['OVERLAP']);
    const same = evaluate(
      [employee('a')],
      [shift('s1', 0, 8, 8, { headcount: 2 })],
      [
        ['s1', 'a'],
        ['s1', 'a'],
      ],
    );
    expect(ids(same)).toEqual(['OVERLAP']);
  });

  it('charges rest shortfall per started hour', () => {
    const contract = { ...CONTRACT, minRestHours: 11 };
    const result = evaluate(
      [employee('a', { contract })],
      [shift('eve', 0, 15, 8), shift('day', 1, 7, 8)],
      [
        ['eve', 'a'],
        ['day', 'a'],
      ],
    );
    // 23:00 -> 07:00 is 8h of rest, 3h short.
    expect(result.violations).toEqual([
      expect.objectContaining({
        constraint: 'MIN_REST',
        penalty: DEFAULT_WEIGHTS.minRest * 3,
        shiftIds: ['eve', 'day'],
      }),
    ]);
    expect(result.violations[0]?.message).toBe(
      'A gets 8.0h rest between eve and day (minimum 11h)',
    );
  });

  it('uses the longest earlier shift as the rest reference', () => {
    const contract = { ...CONTRACT, minRestHours: 2 };
    const result = evaluate(
      [employee('a', { contract })],
      [shift('long', 0, 0, 12), shift('inner', 0, 2, 2), shift('next', 0, 13, 2)],
      [
        ['long', 'a'],
        ['inner', 'a'],
        ['next', 'a'],
      ],
    );
    expect(ids(result).sort()).toEqual(['MIN_REST', 'OVERLAP']);
  });

  it('enforces weekly maximum and minimum hours plus overtime', () => {
    const contract = {
      ...CONTRACT,
      maxHoursPerWeek: 20,
      minHoursPerWeek: 18,
      overtimeAfterHours: 16,
    };
    const shifts = [shift('a', 0, 8, 8), shift('b', 1, 8, 8), shift('c', 2, 8, 8)];
    const heavy = evaluate([employee('x', { contract })], shifts, [
      ['a', 'x'],
      ['b', 'x'],
      ['c', 'x'],
    ]);
    expect(heavy.violations.map((v) => [v.constraint, v.penalty])).toEqual([
      ['MAX_HOURS', DEFAULT_WEIGHTS.maxHours * 4],
      ['OVERTIME', DEFAULT_WEIGHTS.overtime * 8],
    ]);
    expect(heavy.employees[0]).toMatchObject({ hours: 24, overtimeHours: 8, shifts: 3 });
    expect(heavy.employees[0]?.costMinor).toBe(3000 * 24 + 1500 * 8);

    const light = evaluate([employee('x', { contract })], shifts, [['a', 'x']]);
    expect(
      light.violations.filter((v) => v.severity === 'soft').map((v) => [v.constraint, v.penalty]),
    ).toEqual([['MIN_HOURS', DEFAULT_WEIGHTS.minHours * 10]]);
  });

  it('limits consecutive working days per run', () => {
    const contract = { ...CONTRACT, maxConsecutiveDays: 2 };
    const shifts = [0, 1, 2, 3, 5, 6].map((d) => shift(`d${d}`, d, 8, 4));
    const result = evaluate(
      [employee('a', { contract })],
      shifts,
      shifts.map((s) => [s.id, 'a']),
    );
    expect(result.violations).toEqual([
      expect.objectContaining({
        constraint: 'MAX_CONSECUTIVE_DAYS',
        penalty: DEFAULT_WEIGHTS.maxConsecutiveDays * 2,
      }),
    ]);
    expect(result.violations[0]?.message).toBe('A works 4 consecutive days (max 2)');
  });

  it('limits shifts per day', () => {
    const contract = { ...CONTRACT, maxShiftsPerDay: 1 };
    const result = evaluate(
      [employee('a', { contract })],
      [shift('am', 0, 6, 4), shift('pm', 0, 14, 4)],
      [
        ['am', 'a'],
        ['pm', 'a'],
      ],
    );
    expect(result.violations).toEqual([
      expect.objectContaining({ constraint: 'MAX_SHIFTS_PER_DAY', shiftIds: ['am', 'pm'] }),
    ]);
  });

  it('applies soft preferences for days off and nights', () => {
    const result = evaluate(
      [employee('a', { preferences: { preferredDaysOff: [7], avoidNights: true } })],
      [shift('sun', 6, 8, 4), shift('sunN', 6, 22, 1), shift('mon', 0, 9, 4)],
      [
        ['sun', 'a'],
        ['sunN', 'a'],
        ['mon', 'a'],
      ],
    );
    expect(result.violations.map((v) => v.constraint).sort()).toEqual([
      'AVOID_NIGHTS',
      'DAY_OFF_PREFERENCE',
    ]);
    expect(result.violations.find((v) => v.constraint === 'DAY_OFF_PREFERENCE')?.shiftIds).toEqual([
      'sun',
      'sunN',
    ]);
    expect(result.feasible).toBe(true);
  });

  it('measures fairness as utilization variance', () => {
    const contract = { ...CONTRACT, minHoursPerWeek: 8 };
    const shifts = [shift('a', 0, 8, 8), shift('b', 1, 8, 8)];
    const uneven = evaluate([employee('x', { contract }), employee('y', { contract })], shifts, [
      ['a', 'x'],
      ['b', 'x'],
    ]);
    const even = evaluate([employee('x', { contract }), employee('y', { contract })], shifts, [
      ['a', 'x'],
      ['b', 'y'],
    ]);
    expect(uneven.violations.find((v) => v.constraint === 'FAIRNESS')?.penalty).toBe(200);
    expect(uneven.metrics.utilizationStdDev).toBe(1);
    expect(even.violations.some((v) => v.constraint === 'FAIRNESS')).toBe(false);
  });

  it('orders hard violations first, then by penalty', () => {
    const result = evaluate(
      [employee('a', { preferences: { preferredDaysOff: [1], avoidNights: false } })],
      [shift('s1', 0, 8, 8), shift('s2', 1, 8, 8, { headcount: 2 })],
      [['s1', 'a']],
    );
    expect(result.violations.map((v) => v.severity)).toEqual(['hard', 'soft']);
  });

  it('reports labor cost and hours metrics', () => {
    const result = evaluate(
      [employee('a'), employee('b', { hourlyRateMinor: 5000 })],
      [shift('s', 0, 8, 8, { headcount: 2 })],
      [
        ['s', 'a'],
        ['s', 'b'],
      ],
    );
    expect(result.metrics).toMatchObject({
      totalHours: 16,
      laborCostMinor: 8 * 3000 + 8 * 5000,
      coverageRatio: 1,
    });
  });
});

describe('slot mapping', () => {
  const compiled = compileProblem(
    problem([employee('a'), employee('b')], [shift('s', 0, 8, 8, { headcount: 2 })]),
  );

  it('round-trips assignments through slot arrays', () => {
    const slots = toSlotAssignment(compiled, [{ shiftId: 's', employeeId: 'b' }]);
    expect(Array.from(slots)).toEqual([1, -1]);
    expect(fromSlotAssignment(compiled, slots)).toEqual([{ shiftId: 's', employeeId: 'b' }]);
    expect(evaluateSolution(compiled, slots).metrics.slotsFilled).toBe(1);
  });

  it('rejects unknown ids and over-assignment', () => {
    expect(() =>
      toSlotAssignment(compiled, [
        { shiftId: 's', employeeId: 'a' },
        { shiftId: 's', employeeId: 'b' },
        { shiftId: 's', employeeId: 'a' },
        { shiftId: 'x', employeeId: 'zzz' },
      ]),
    ).toThrow(ProblemValidationError);
  });
});

describe('constraint catalog', () => {
  it('documents every constraint id exactly once', () => {
    const catalogIds = CONSTRAINTS.map((c) => c.id);
    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    expect(catalogIds).toHaveLength(14);
  });

  it('merges weight overrides onto defaults', () => {
    expect(resolveWeights({ fairness: 0 })).toEqual({ ...DEFAULT_WEIGHTS, fairness: 0 });
    expect(resolveWeights(undefined)).toEqual(DEFAULT_WEIGHTS);
  });
});
