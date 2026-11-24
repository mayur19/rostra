import type { Contract, EmployeeInput, ProblemInput, ShiftInput } from '../src/index.js';

export const TZ = 'UTC';
export const WEEK = '2026-03-02'; // a Monday

export const CONTRACT: Contract = {
  minHoursPerWeek: 0,
  maxHoursPerWeek: 60,
  overtimeAfterHours: 60,
  maxConsecutiveDays: 7,
  minRestHours: 0,
  maxShiftsPerDay: 3,
};

export function employee(id: string, overrides: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    id,
    name: id.toUpperCase(),
    hourlyRateMinor: 3000,
    skills: [{ skill: 'RN', expiresOn: null }],
    contract: CONTRACT,
    unavailability: [],
    preferences: { preferredDaysOff: [], avoidNights: false },
    ...overrides,
  };
}

/** Shift on day offset `day` (0 = Monday 2026-03-02) from `startHour` for `hours` hours (UTC). */
export function shift(
  id: string,
  day: number,
  startHour: number,
  hours: number,
  overrides: Partial<ShiftInput> = {},
): ShiftInput {
  const start = Date.UTC(2026, 2, 2 + day, 0, 0) + startHour * 3_600_000;
  return {
    id,
    label: id,
    start: new Date(start).toISOString(),
    end: new Date(start + hours * 3_600_000).toISOString(),
    skill: 'RN',
    headcount: 1,
    ...overrides,
  };
}

export function problem(
  employees: EmployeeInput[],
  shifts: ShiftInput[],
  extra: Partial<ProblemInput> = {},
): ProblemInput {
  return { timezone: TZ, weekStart: WEEK, employees, shifts, ...extra };
}
