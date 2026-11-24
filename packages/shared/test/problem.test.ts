import { describe, expect, it } from 'vitest';
import {
  ProblemValidationError,
  compileProblem,
  rosterDates,
  validateProblem,
} from '../src/index.js';
import { CONTRACT, employee, problem, shift } from './helpers.js';

describe('validateProblem', () => {
  it('accepts a well-formed problem', () => {
    expect(validateProblem(problem([employee('a')], [shift('s1', 0, 8, 8)]))).toEqual([]);
  });

  it('rejects unknown zones and bad week starts before anything else', () => {
    expect(validateProblem(problem([], [], { timezone: 'Nowhere/City' }))).toEqual([
      'unknown time zone "Nowhere/City"',
    ]);
    expect(validateProblem(problem([], [], { weekStart: '2026-02-30' }))[0]).toMatch(/weekStart/);
  });

  it('reports duplicates, bad shifts and contracts', () => {
    const issues = validateProblem(
      problem(
        [
          employee('a'),
          employee('a', { contract: { ...CONTRACT, minHoursPerWeek: 50, maxHoursPerWeek: 40 } }),
          employee('b', { contract: { ...CONTRACT, maxConsecutiveDays: 0, maxShiftsPerDay: 0 } }),
        ],
        [
          shift('s1', 0, 8, 8),
          shift('s1', 1, 8, 8),
          shift('backwards', 0, 8, -1),
          shift('late', 8, 8, 8),
          shift('zero', 0, 8, 8, { headcount: 0 }),
          { ...shift('bad', 0, 8, 8), start: 'not-a-date' },
        ],
      ),
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'duplicate employee id a',
        'duplicate shift id s1',
        'employee A: minHoursPerWeek exceeds maxHoursPerWeek',
        'employee B: maxConsecutiveDays < 1',
        'employee B: maxShiftsPerDay < 1',
        'shift backwards: end must be after start',
        'shift late: starts outside the roster week',
        'shift zero: headcount must be a positive integer',
        'shift bad: invalid start/end',
      ]),
    );
  });

  it('validates pinned assignments', () => {
    const issues = validateProblem(
      problem([employee('a'), employee('b')], [shift('s1', 0, 8, 8)], {
        pinned: [
          { shiftId: 's1', employeeId: 'a' },
          { shiftId: 's1', employeeId: 'b' },
          { shiftId: 'nope', employeeId: 'a' },
          { shiftId: 's1', employeeId: 'ghost' },
        ],
      }),
    );
    expect(issues).toEqual([
      'pinned: shift s1 exceeds headcount',
      'pinned: unknown shift nope',
      'pinned: unknown employee ghost',
      'pinned: shift s1 exceeds headcount',
    ]);
  });
});

describe('compileProblem', () => {
  it('throws a typed error listing every issue', () => {
    try {
      compileProblem(problem([], [shift('x', 0, 8, -2)]));
      expect.fail('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemValidationError);
      expect((error as ProblemValidationError).issues).toEqual([
        'shift x: end must be after start',
      ]);
    }
  });

  it('expands headcount into slots and applies pins in order', () => {
    const compiled = compileProblem(
      problem([employee('a'), employee('b')], [shift('s1', 0, 8, 8, { headcount: 3 })], {
        pinned: [{ shiftId: 's1', employeeId: 'b' }],
      }),
    );
    expect(compiled.slots.map((s) => s.pinnedEmployee)).toEqual([1, -1, -1]);
  });

  it('derives day index, weekday, duration and night flags', () => {
    const compiled = compileProblem(
      problem(
        [employee('a')],
        [shift('day', 2, 7, 8), shift('night', 6, 22, 9), shift('early', 1, 3, 4)],
      ),
    );
    expect(compiled.shifts.map((s) => [s.dayIndex, s.isoWeekday, s.minutes, s.isNight])).toEqual([
      [2, 3, 480, false],
      [6, 7, 540, true],
      [1, 2, 240, true],
    ]);
  });

  it('precomputes static eligibility: skill, expiry and unavailability', () => {
    const compiled = compileProblem(
      problem(
        [
          employee('ok'),
          employee('cna', { skills: [{ skill: 'CNA', expiresOn: null }] }),
          employee('lapsed', { skills: [{ skill: 'RN', expiresOn: '2026-03-02' }] }),
          employee('away', {
            unavailability: [
              { start: '2026-03-03T10:00:00Z', end: '2026-03-03T11:00:00Z', reason: 'time_off' },
            ],
          }),
        ],
        [shift('tue', 1, 8, 8)],
      ),
    );
    expect(compiled.staticReason).toEqual([
      'none',
      'SKILL_MISSING',
      'SKILL_EXPIRED',
      'UNAVAILABLE',
    ]);
    expect(compiled.eligible).toEqual([[0]]);
  });

  it('treats a certification expiring on the shift day as still valid', () => {
    const compiled = compileProblem(
      problem(
        [employee('a', { skills: [{ skill: 'RN', expiresOn: '2026-03-03' }] })],
        [shift('tue', 1, 8, 8)],
      ),
    );
    expect(compiled.staticReason).toEqual(['none']);
  });

  it('lists the seven roster dates', () => {
    expect(rosterDates('2026-03-02')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });
});
