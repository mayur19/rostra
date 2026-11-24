import { describe, expect, it } from 'vitest';
import {
  employeeCreateSchema,
  hasPermission,
  registerSchema,
  rosterCreateSchema,
  shiftCreateSchema,
  solveRequestSchema,
  ROLE_PERMISSIONS,
} from '../src/index.js';

describe('schemas', () => {
  it('normalises registration input', () => {
    const parsed = registerSchema.parse({
      organizationName: ' St Jude Ward ',
      name: 'Mo',
      email: 'MO@Example.org ',
      password: 'correct horse battery',
    });
    expect(parsed).toMatchObject({
      organizationName: 'St Jude Ward',
      email: 'mo@example.org',
      timezone: 'UTC',
    });
    expect(
      registerSchema.safeParse({ organizationName: 'x', name: '', email: 'bad', password: 'short' })
        .success,
    ).toBe(false);
  });

  it('applies employee defaults and rejects inverted contracts', () => {
    const base = {
      name: 'Ava',
      hourlyRateMinor: 4000,
      contract: {
        minHoursPerWeek: 20,
        maxHoursPerWeek: 40,
        maxConsecutiveDays: 5,
        minRestHours: 11,
      },
    };
    const parsed = employeeCreateSchema.parse(base);
    expect(parsed.contract).toMatchObject({ overtimeAfterHours: 40, maxShiftsPerDay: 1 });
    expect(parsed.preferences).toEqual({ preferredDaysOff: [], avoidNights: false });
    expect(
      employeeCreateSchema.safeParse({
        ...base,
        contract: { ...base.contract, minHoursPerWeek: 50 },
      }).success,
    ).toBe(false);
  });

  it('validates rosters, shifts and solve requests', () => {
    expect(
      rosterCreateSchema.safeParse({
        name: 'W10',
        weekStart: '2026-03-02',
        timezone: 'Europe/London',
      }).success,
    ).toBe(true);
    expect(
      rosterCreateSchema.safeParse({
        name: 'W10',
        weekStart: '2026-13-02',
        timezone: 'Europe/London',
      }).success,
    ).toBe(false);
    const shift = {
      label: 'Day',
      start: '2026-03-02T07:00:00Z',
      end: '2026-03-02T15:00:00Z',
      skill: 'RN',
      headcount: 2,
    };
    expect(shiftCreateSchema.safeParse(shift).success).toBe(true);
    expect(shiftCreateSchema.safeParse({ ...shift, end: '2026-03-03T07:00:00Z' }).success).toBe(
      false,
    );
    expect(shiftCreateSchema.safeParse({ ...shift, skill: 'rn' }).success).toBe(false);
    expect(solveRequestSchema.parse({})).toEqual({ seed: 1, iterations: 20_000, keepPinned: true });
  });
});

describe('permissions', () => {
  it('grants owners everything and employees read-only rosters', () => {
    expect(hasPermission('owner', 'org:manage')).toBe(true);
    expect(hasPermission('admin', 'org:manage')).toBe(false);
    expect(hasPermission('scheduler', 'rosters:solve')).toBe(true);
    expect(hasPermission('employee', 'rosters:solve')).toBe(false);
    expect(ROLE_PERMISSIONS.employee).toEqual(['rosters:read']);
  });
});
