import type { ShiftTemplate } from '../model/templates.js';
import { expandTemplates } from '../model/templates.js';
import type { Contract, EmployeeInput, ProblemInput } from '../model/types.js';
import { createRng } from './rng.js';
import { addDays, zonedToUtc } from '../time/zoned.js';

/**
 * Deterministic synthetic ward rosters used by the seed script, tests and benchmark.
 * The shape mirrors a hospital unit: day/evening/night shifts needing RN, CNA and
 * charge-nurse skills, a mix of full- and part-time contracts and some time off.
 */
export const FULL_TIME: Contract = {
  minHoursPerWeek: 32,
  maxHoursPerWeek: 48,
  overtimeAfterHours: 40,
  maxConsecutiveDays: 5,
  minRestHours: 11,
  maxShiftsPerDay: 1,
};

export const PART_TIME: Contract = {
  minHoursPerWeek: 16,
  maxHoursPerWeek: 30,
  overtimeAfterHours: 40,
  maxConsecutiveDays: 4,
  minRestHours: 11,
  maxShiftsPerDay: 1,
};

export const WARD_TEMPLATES: readonly ShiftTemplate[] = [
  {
    code: 'DAY-RN',
    label: 'Day RN',
    startMinute: 7 * 60,
    durationMinutes: 8 * 60,
    skill: 'RN',
    headcount: 3,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    code: 'EVE-RN',
    label: 'Evening RN',
    startMinute: 15 * 60,
    durationMinutes: 8 * 60,
    skill: 'RN',
    headcount: 2,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    code: 'NGT-RN',
    label: 'Night RN',
    startMinute: 23 * 60,
    durationMinutes: 8 * 60,
    skill: 'RN',
    headcount: 1,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    code: 'DAY-CNA',
    label: 'Day CNA',
    startMinute: 7 * 60,
    durationMinutes: 8 * 60,
    skill: 'CNA',
    headcount: 2,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    code: 'EVE-CNA',
    label: 'Evening CNA',
    startMinute: 15 * 60,
    durationMinutes: 8 * 60,
    skill: 'CNA',
    headcount: 1,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    code: 'DAY-CHG',
    label: 'Day Charge',
    startMinute: 7 * 60,
    durationMinutes: 8 * 60,
    skill: 'CHARGE',
    headcount: 1,
    days: [0, 1, 2, 3, 4],
  },
];

const FIRST = [
  'Ava',
  'Ben',
  'Chloe',
  'Dev',
  'Elena',
  'Farah',
  'Gus',
  'Hana',
  'Ivan',
  'Jade',
  'Kofi',
  'Lena',
  'Mateo',
  'Nora',
  'Omar',
  'Priya',
  'Quinn',
  'Rosa',
  'Sam',
  'Tara',
  'Umar',
  'Vera',
  'Wes',
  'Yara',
  'Zane',
];
const LAST = [
  'Patel',
  'Okafor',
  'Nguyen',
  'Silva',
  'Kowalski',
  'Haddad',
  'Murphy',
  'Tanaka',
  'Novak',
  'Reyes',
];

export interface FixtureOptions {
  readonly seed: number;
  readonly employees: number;
  readonly weekStart?: string;
  readonly timezone?: string;
  /** Multiplies template headcount (useful for benchmark scaling). */
  readonly demandScale?: number;
}

function skillsFor(i: number, rnRatio: number, weekStart: string): EmployeeInput['skills'] {
  const isRn = i % 10 < rnRatio * 10;
  if (!isRn) return [{ skill: 'CNA', expiresOn: null }];
  const grants: EmployeeInput['skills'] = [{ skill: 'RN', expiresOn: null }];
  if (i % 4 !== 0) return grants;
  // Every eighth charge nurse lets the certification lapse mid-week.
  const expiresOn = i % 8 === 4 ? addDays(weekStart, 2) : null;
  return [...grants, { skill: 'CHARGE', expiresOn }];
}

function timeOffFor(
  i: number,
  weekStart: string,
  timezone: string,
): EmployeeInput['unavailability'] {
  if (i % 7 !== 3) return [];
  const start = zonedToUtc(addDays(weekStart, 2), 0, timezone);
  const end = zonedToUtc(addDays(weekStart, 4), 0, timezone);
  return [
    { start: new Date(start).toISOString(), end: new Date(end).toISOString(), reason: 'time_off' },
  ];
}

export function generateWardProblem(options: FixtureOptions): ProblemInput {
  const rng = createRng(options.seed);
  const weekStart = options.weekStart ?? '2026-03-02';
  const timezone = options.timezone ?? 'America/New_York';
  const scale = options.demandScale ?? 1;
  const templates = WARD_TEMPLATES.map((t) => ({
    ...t,
    headcount: Math.max(1, Math.round(t.headcount * scale)),
  }));
  const employees: EmployeeInput[] = Array.from({ length: options.employees }, (_, i) => {
    const partTime = i % 3 === 2;
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length + i) % LAST.length]}`;
    const offDay = 1 + rng.int(7);
    return {
      id: `emp-${String(i + 1).padStart(3, '0')}`,
      name,
      hourlyRateMinor: (partTime ? 3400 : 4200) + rng.int(800),
      skills: skillsFor(i, 0.6, weekStart),
      contract: partTime ? PART_TIME : FULL_TIME,
      unavailability: timeOffFor(i, weekStart, timezone),
      preferences: { preferredDaysOff: [offDay], avoidNights: rng.next() < 0.3 },
    };
  });
  return {
    timezone,
    weekStart,
    employees,
    shifts: expandTemplates(weekStart, timezone, templates),
  };
}
