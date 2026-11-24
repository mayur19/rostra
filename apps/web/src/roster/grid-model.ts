import {
  addDays,
  daysBetween,
  localDateKey,
  localMinuteOfDay,
  type Violation,
} from '@rostra/shared';
import type { Assignment, ScheduleEmployee, Shift } from '../api/types';

export interface GridCell {
  readonly shiftId: string;
  readonly label: string;
  readonly skill: string;
  readonly time: string;
  readonly pinned: boolean;
  readonly flagged: boolean;
}

export interface GridRow {
  readonly employeeId: string;
  readonly name: string;
  readonly hours: number;
  readonly days: readonly (readonly GridCell[])[];
  readonly violationCount: number;
}

export interface GridModel {
  readonly dates: readonly string[];
  readonly rows: readonly GridRow[];
  readonly openSlots: readonly { date: string; label: string; missing: number }[];
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeRange(shift: Shift, timezone: string): string {
  return `${hhmm(localMinuteOfDay(Date.parse(shift.start), timezone))}-${hhmm(localMinuteOfDay(Date.parse(shift.end), timezone))}`;
}

/**
 * Pure projection of a schedule into a week grid: one row per employee, one column per
 * local date in the roster zone, plus per-day open (unfilled) slots.
 */
export function buildGrid(input: {
  weekStart: string;
  timezone: string;
  shifts: readonly Shift[];
  employees: readonly ScheduleEmployee[];
  assignments: readonly Assignment[];
  violations: readonly Violation[];
}): GridModel {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i));
  const shiftById = new Map(input.shifts.map((s) => [s.id, s] as const));
  const dayOf = (shift: Shift) =>
    daysBetween(input.weekStart, localDateKey(Date.parse(shift.start), input.timezone));
  const flaggedPairs = new Set(
    input.violations
      .filter((v) => v.employeeId && v.severity === 'hard')
      .flatMap((v) => v.shiftIds.map((id) => `${v.employeeId}|${id}`)),
  );

  const rows = input.employees.map((employee) => {
    const days: GridCell[][] = dates.map(() => []);
    let minutes = 0;
    for (const a of input.assignments.filter((x) => x.employeeId === employee.id)) {
      const shift = shiftById.get(a.shiftId);
      if (!shift) continue;
      minutes += (Date.parse(shift.end) - Date.parse(shift.start)) / 60_000;
      days[dayOf(shift)]?.push({
        shiftId: shift.id,
        label: shift.label,
        skill: shift.skill,
        time: timeRange(shift, input.timezone),
        pinned: a.pinned,
        flagged: flaggedPairs.has(`${employee.id}|${shift.id}`),
      });
    }
    return {
      employeeId: employee.id,
      name: employee.name,
      hours: minutes / 60,
      days,
      violationCount: input.violations.filter((v) => v.employeeId === employee.id).length,
    };
  });

  const filled = new Map<string, number>();
  for (const a of input.assignments) filled.set(a.shiftId, (filled.get(a.shiftId) ?? 0) + 1);
  const openSlots = input.shifts
    .map((s) => ({
      date: dates[dayOf(s)] ?? '',
      label: s.label,
      missing: s.headcount - (filled.get(s.id) ?? 0),
    }))
    .filter((s) => s.missing > 0);

  return { dates, rows, openSlots };
}
