import type { Violation } from '@rostra/shared';
import type { Assignment, ScheduleEmployee, Shift } from '../src/api/types';

export const WEEK = '2026-03-02';
export const TZ = 'America/New_York';

export const shifts: Shift[] = [
  {
    id: 's-mon',
    label: 'Day RN 2026-03-02',
    start: '2026-03-02T12:00:00Z',
    end: '2026-03-02T20:00:00Z',
    skill: 'RN',
    headcount: 2,
  },
  {
    id: 's-sun',
    label: 'Night RN 2026-03-08',
    start: '2026-03-09T03:00:00Z',
    end: '2026-03-09T11:00:00Z',
    skill: 'RN',
    headcount: 1,
  },
  {
    id: 's-tue',
    label: 'Day CNA 2026-03-03',
    start: '2026-03-03T12:00:00Z',
    end: '2026-03-03T20:00:00Z',
    skill: 'CNA',
    headcount: 1,
  },
];

export const employees: ScheduleEmployee[] = [
  {
    id: 'e1',
    name: 'Ava Patel',
    skills: [{ skill: 'RN', expiresOn: null }],
    contract: { minHoursPerWeek: 0, maxHoursPerWeek: 40 },
  },
  {
    id: 'e2',
    name: 'Ben Okafor',
    skills: [{ skill: 'CNA', expiresOn: null }],
    contract: { minHoursPerWeek: 0, maxHoursPerWeek: 40 },
  },
];

export const assignments: Assignment[] = [
  { shiftId: 's-mon', employeeId: 'e1', pinned: true, source: 'manual' },
  { shiftId: 's-sun', employeeId: 'e1', pinned: false, source: 'solver' },
  { shiftId: 's-tue', employeeId: 'e2', pinned: false, source: 'solver' },
];

export const violations: Violation[] = [
  {
    constraint: 'UNFILLED_SLOT',
    severity: 'hard',
    penalty: 10,
    employeeId: null,
    shiftIds: ['s-mon'],
    message: 'Day RN 2026-03-02 needs 1 more RN staff',
  },
  {
    constraint: 'AVOID_NIGHTS',
    severity: 'soft',
    penalty: 10,
    employeeId: 'e1',
    shiftIds: ['s-sun'],
    message: 'AVA PATEL prefers not to work nights',
  },
  {
    constraint: 'SKILL_MISSING',
    severity: 'hard',
    penalty: 10,
    employeeId: 'e2',
    shiftIds: ['s-tue'],
    message: 'Ben lacks a skill',
  },
];
