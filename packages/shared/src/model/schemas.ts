import { z } from 'zod';
import { isValidDateKey, isValidTimeZone } from '../time/zoned.js';
import { MAX_ITERATIONS } from '../solver/solve.js';

export const dateKeySchema = z
  .string()
  .refine(isValidDateKey, 'Expected a calendar date YYYY-MM-DD');
export const timeZoneSchema = z.string().min(1).refine(isValidTimeZone, 'Unknown IANA time zone');
export const instantSchema = z.string().datetime({ offset: true });
export const skillCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,31}$/, 'Skill codes are 2-32 upper-case letters, digits or _');

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(200),
  timezone: timeZoneSchema.default('UTC'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const contractSchema = z
  .object({
    minHoursPerWeek: z.number().min(0).max(80),
    maxHoursPerWeek: z.number().min(0).max(100),
    overtimeAfterHours: z.number().min(0).max(100).default(40),
    maxConsecutiveDays: z.number().int().min(1).max(7),
    minRestHours: z.number().min(0).max(24),
    maxShiftsPerDay: z.number().int().min(1).max(3).default(1),
  })
  .refine((c) => c.minHoursPerWeek <= c.maxHoursPerWeek, {
    message: 'minHoursPerWeek must not exceed maxHoursPerWeek',
    path: ['minHoursPerWeek'],
  });

export const skillGrantSchema = z.object({
  skill: skillCodeSchema,
  expiresOn: dateKeySchema.nullable().default(null),
});

export const unavailabilitySchema = z
  .object({
    start: instantSchema,
    end: instantSchema,
    reason: z.enum(['time_off', 'unavailable']).default('unavailable'),
  })
  .refine((u) => Date.parse(u.end) > Date.parse(u.start), { message: 'end must be after start' });

export const preferencesSchema = z.object({
  preferredDaysOff: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  avoidNights: z.boolean().default(false),
});

export const employeeCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254).nullable().default(null),
  hourlyRateMinor: z.number().int().min(0).max(10_000_000),
  contract: contractSchema,
  skills: z.array(skillGrantSchema).max(50).default([]),
  unavailability: z.array(unavailabilitySchema).max(200).default([]),
  preferences: preferencesSchema.default({}),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const skillCreateSchema = z.object({
  code: skillCodeSchema,
  name: z.string().trim().min(1).max(120),
});

export const rosterCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  weekStart: dateKeySchema,
  timezone: timeZoneSchema,
});

export const shiftCreateSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    start: instantSchema,
    end: instantSchema,
    skill: skillCodeSchema,
    headcount: z.number().int().min(1).max(50),
  })
  .refine((s) => Date.parse(s.end) > Date.parse(s.start), { message: 'end must be after start' })
  .refine((s) => Date.parse(s.end) - Date.parse(s.start) <= 16 * 3_600_000, {
    message: 'shifts may not exceed 16 hours',
  });

export const assignmentSchema = z.object({
  shiftId: z.string().uuid(),
  employeeId: z.string().uuid(),
});

export const solveRequestSchema = z.object({
  seed: z
    .number()
    .int()
    .min(0)
    .max(2 ** 32 - 1)
    .default(1),
  iterations: z.number().int().min(0).max(MAX_ITERATIONS).default(20_000),
  keepPinned: z.boolean().default(true),
});

export const evaluateRequestSchema = z.object({
  assignments: z.array(assignmentSchema).max(5000),
});

export const pinRequestSchema = z.object({
  assignments: z.array(assignmentSchema.extend({ pinned: z.boolean() })).max(5000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type RosterCreateInput = z.infer<typeof rosterCreateSchema>;
export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type SolveRequest = z.infer<typeof solveRequestSchema>;
export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;
