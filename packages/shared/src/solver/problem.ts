import { resolveWeights } from '../model/constraints.js';
import type { ConstraintWeights, Contract, ProblemInput } from '../model/types.js';
import {
  addDays,
  daysBetween,
  isValidDateKey,
  isValidTimeZone,
  isoWeekday,
  localDateKey,
  localMinuteOfDay,
} from '../time/zoned.js';

/** Local start times at or after 20:00 or before 05:00 count as night shifts. */
export const NIGHT_START_MINUTE = 20 * 60;
export const NIGHT_END_MINUTE = 5 * 60;
export const ROSTER_DAYS = 7;

export type StaticReason = 'none' | 'SKILL_MISSING' | 'SKILL_EXPIRED' | 'UNAVAILABLE';

export interface CompiledShift {
  readonly index: number;
  readonly id: string;
  readonly label: string;
  readonly skill: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly minutes: number;
  readonly dayIndex: number;
  readonly localDate: string;
  readonly isoWeekday: number;
  readonly isNight: boolean;
  readonly headcount: number;
}

export interface CompiledEmployee {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly hourlyRateMinor: number;
  readonly contract: Contract;
  readonly preferredDaysOff: ReadonlySet<number>;
  readonly avoidNights: boolean;
}

export interface CompiledSlot {
  readonly index: number;
  readonly shiftIndex: number;
  /** Employee index fixed by a pinned assignment, or -1 when the solver may choose. */
  readonly pinnedEmployee: number;
}

export interface CompiledProblem {
  readonly timezone: string;
  readonly weekStart: string;
  readonly weights: ConstraintWeights;
  readonly shifts: readonly CompiledShift[];
  readonly employees: readonly CompiledEmployee[];
  readonly slots: readonly CompiledSlot[];
  readonly employeeIndexById: ReadonlyMap<string, number>;
  readonly shiftIndexById: ReadonlyMap<string, number>;
  /** Row-major [employee * shiftCount + shift] reason an assignment is statically illegal. */
  readonly staticReason: readonly StaticReason[];
  /** Employees with no static violation for each shift, in input order. */
  readonly eligible: readonly (readonly number[])[];
}

export class ProblemValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid scheduling problem: ${issues.join('; ')}`);
    this.name = 'ProblemValidationError';
  }
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

function validateContract(name: string, contract: Contract): string[] {
  const issues: string[] = [];
  if (contract.minHoursPerWeek > contract.maxHoursPerWeek) {
    issues.push(`employee ${name}: minHoursPerWeek exceeds maxHoursPerWeek`);
  }
  if (contract.maxConsecutiveDays < 1) issues.push(`employee ${name}: maxConsecutiveDays < 1`);
  if (contract.maxShiftsPerDay < 1) issues.push(`employee ${name}: maxShiftsPerDay < 1`);
  return issues;
}

export function validateProblem(input: ProblemInput): string[] {
  const issues: string[] = [];
  if (!isValidTimeZone(input.timezone)) issues.push(`unknown time zone "${input.timezone}"`);
  if (!isValidDateKey(input.weekStart)) issues.push(`invalid weekStart "${input.weekStart}"`);
  if (issues.length > 0) return issues;

  for (const id of duplicates(input.employees.map((e) => e.id))) {
    issues.push(`duplicate employee id ${id}`);
  }
  for (const id of duplicates(input.shifts.map((s) => s.id))) {
    issues.push(`duplicate shift id ${id}`);
  }
  for (const employee of input.employees) {
    issues.push(...validateContract(employee.name, employee.contract));
  }
  for (const shift of input.shifts) {
    const start = Date.parse(shift.start);
    const end = Date.parse(shift.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      issues.push(`shift ${shift.id}: invalid start/end`);
      continue;
    }
    if (end <= start) issues.push(`shift ${shift.id}: end must be after start`);
    if (!Number.isInteger(shift.headcount) || shift.headcount < 1) {
      issues.push(`shift ${shift.id}: headcount must be a positive integer`);
    }
    const day = daysBetween(input.weekStart, localDateKey(start, input.timezone));
    if (day < 0 || day >= ROSTER_DAYS) {
      issues.push(`shift ${shift.id}: starts outside the roster week`);
    }
  }
  issues.push(...validatePinned(input));
  return issues;
}

function validatePinned(input: ProblemInput): string[] {
  const issues: string[] = [];
  const employeeIds = new Set(input.employees.map((e) => e.id));
  const headcount = new Map(input.shifts.map((s) => [s.id, s.headcount] as const));
  const used = new Map<string, number>();
  for (const pin of input.pinned ?? []) {
    if (!employeeIds.has(pin.employeeId)) issues.push(`pinned: unknown employee ${pin.employeeId}`);
    const capacity = headcount.get(pin.shiftId);
    if (capacity === undefined) {
      issues.push(`pinned: unknown shift ${pin.shiftId}`);
      continue;
    }
    const count = (used.get(pin.shiftId) ?? 0) + 1;
    used.set(pin.shiftId, count);
    if (count > capacity) issues.push(`pinned: shift ${pin.shiftId} exceeds headcount`);
  }
  return issues;
}

function compileShifts(input: ProblemInput): CompiledShift[] {
  return input.shifts.map((shift, index) => {
    const startMs = Date.parse(shift.start);
    const endMs = Date.parse(shift.end);
    const localDate = localDateKey(startMs, input.timezone);
    const startMinute = localMinuteOfDay(startMs, input.timezone);
    return {
      index,
      id: shift.id,
      label: shift.label,
      skill: shift.skill,
      startMs,
      endMs,
      minutes: Math.round((endMs - startMs) / 60_000),
      dayIndex: daysBetween(input.weekStart, localDate),
      localDate,
      isoWeekday: isoWeekday(localDate),
      isNight: startMinute >= NIGHT_START_MINUTE || startMinute < NIGHT_END_MINUTE,
      headcount: shift.headcount,
    };
  });
}

function staticReasonFor(
  input: ProblemInput,
  employeeIndex: number,
  shift: CompiledShift,
): StaticReason {
  const employee = input.employees[employeeIndex];
  if (!employee) return 'SKILL_MISSING';
  const grant = employee.skills.find((g) => g.skill === shift.skill);
  if (!grant) return 'SKILL_MISSING';
  if (grant.expiresOn !== null && grant.expiresOn < shift.localDate) return 'SKILL_EXPIRED';
  const blocked = employee.unavailability.some(
    (u) => Date.parse(u.start) < shift.endMs && Date.parse(u.end) > shift.startMs,
  );
  return blocked ? 'UNAVAILABLE' : 'none';
}

function compileSlots(
  input: ProblemInput,
  shifts: readonly CompiledShift[],
  employeeIndexById: ReadonlyMap<string, number>,
): CompiledSlot[] {
  const pinsByShift = new Map<string, number[]>();
  for (const pin of input.pinned ?? []) {
    const list = pinsByShift.get(pin.shiftId) ?? [];
    pinsByShift.set(pin.shiftId, [...list, employeeIndexById.get(pin.employeeId) ?? -1]);
  }
  const slots: CompiledSlot[] = [];
  for (const shift of shifts) {
    const pins = pinsByShift.get(shift.id) ?? [];
    for (let k = 0; k < shift.headcount; k += 1) {
      slots.push({ index: slots.length, shiftIndex: shift.index, pinnedEmployee: pins[k] ?? -1 });
    }
  }
  return slots;
}

/** Validates and indexes a problem so evaluation and search run on flat arrays. */
export function compileProblem(input: ProblemInput): CompiledProblem {
  const issues = validateProblem(input);
  if (issues.length > 0) throw new ProblemValidationError(issues);

  const shifts = compileShifts(input);
  const employees: CompiledEmployee[] = input.employees.map((e, index) => ({
    index,
    id: e.id,
    name: e.name,
    hourlyRateMinor: e.hourlyRateMinor,
    contract: e.contract,
    preferredDaysOff: new Set(e.preferences.preferredDaysOff),
    avoidNights: e.preferences.avoidNights,
  }));
  const employeeIndexById = new Map(employees.map((e) => [e.id, e.index] as const));
  const shiftIndexById = new Map(shifts.map((s) => [s.id, s.index] as const));

  const staticReason: StaticReason[] = [];
  for (let e = 0; e < employees.length; e += 1) {
    for (const shift of shifts) staticReason.push(staticReasonFor(input, e, shift));
  }
  const eligible = shifts.map((shift) =>
    employees
      .filter((e) => staticReason[e.index * shifts.length + shift.index] === 'none')
      .map((e) => e.index),
  );

  return {
    timezone: input.timezone,
    weekStart: input.weekStart,
    weights: resolveWeights(input.weights),
    shifts,
    employees,
    slots: compileSlots(input, shifts, employeeIndexById),
    employeeIndexById,
    shiftIndexById,
    staticReason,
    eligible,
  };
}

export function rosterDates(weekStart: string): string[] {
  return Array.from({ length: ROSTER_DAYS }, (_, day) => addDays(weekStart, day));
}
