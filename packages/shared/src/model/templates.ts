import type { ShiftInput } from './types.js';
import { addDays, zonedToUtc } from '../time/zoned.js';

/** A recurring weekly shift pattern expressed in local wall-clock time. */
export interface ShiftTemplate {
  readonly code: string;
  readonly label: string;
  /** Minutes after local midnight. */
  readonly startMinute: number;
  /** Wall-clock length; overnight shifts simply exceed midnight. */
  readonly durationMinutes: number;
  readonly skill: string;
  readonly headcount: number;
  /** Day offsets within the roster week (0 = weekStart). */
  readonly days: readonly number[];
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function dayLabel(isoWeekday: number): string {
  return DAY_NAMES[(isoWeekday - 1 + 7) % 7] ?? '?';
}

/**
 * Expands templates into concrete shifts for one week. Start and end are resolved
 * from local wall time independently, so a 22:00-06:00 night on a DST change is
 * 7 or 9 real hours, matching what the employee actually works and is paid for.
 */
export function expandTemplates(
  weekStart: string,
  timeZone: string,
  templates: readonly ShiftTemplate[],
): ShiftInput[] {
  return templates.flatMap((template) =>
    [...template.days]
      .sort((a, b) => a - b)
      .map((day) => {
        const date = addDays(weekStart, day);
        const start = zonedToUtc(date, template.startMinute, timeZone);
        const end = zonedToUtc(date, template.startMinute + template.durationMinutes, timeZone);
        return {
          id: `${template.code}-${date}`,
          label: `${template.label} ${date}`,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          skill: template.skill,
          headcount: template.headcount,
        };
      }),
  );
}
