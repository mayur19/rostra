/**
 * Time-zone helpers built on Intl only (no tz database dependency).
 *
 * All instants are UTC epoch milliseconds. "Date keys" are local calendar dates
 * formatted as YYYY-MM-DD in a given IANA zone. Conversions are DST-safe:
 * nonexistent wall times (spring-forward gap) resolve forward, ambiguous wall
 * times (fall-back overlap) resolve to the earlier instant.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formatters are cached only under canonical IANA names, so the cache is bounded by
 * the number of zones the runtime knows about no matter how callers spell them.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const created = createFormatter(timeZone);
  const canonical = created.resolvedOptions().timeZone;
  const existing = formatterCache.get(canonical);
  if (existing) return existing;
  formatterCache.set(canonical, created);
  return created;
}

/** Canonical IANA spelling of a zone (e.g. "america/new_york" -> "America/New_York"), or null. */
export function canonicalTimeZone(timeZone: string): string | null {
  try {
    return createFormatter(timeZone).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Number of cached formatters; exposed for tests guarding the cache bound. */
export function formatterCacheSize(): number {
  return formatterCache.size;
}

export interface WallTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export function isValidTimeZone(timeZone: string): boolean {
  return canonicalTimeZone(timeZone) !== null;
}

export function wallTime(instantMs: number, timeZone: string): WallTime {
  const values: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Offset of the zone from UTC at the given instant, in milliseconds. */
export function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const w = wallTime(instantMs, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const truncated = instantMs - (((instantMs % 1000) + 1000) % 1000);
  return asUtc - truncated;
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = DATE_KEY.exec(dateKey);
  if (!match) throw new RangeError(`Invalid date key "${dateKey}" (expected YYYY-MM-DD)`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RangeError(`Invalid calendar date "${dateKey}"`);
  }
  return { year, month, day };
}

export function isValidDateKey(dateKey: string): boolean {
  try {
    parseDateKey(dateKey);
    return true;
  } catch {
    return false;
  }
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function addDays(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return formatDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
  );
}

/** ISO weekday of a date key: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function localDateKey(instantMs: number, timeZone: string): string {
  const w = wallTime(instantMs, timeZone);
  return formatDateKey(w.year, w.month, w.day);
}

export function localMinuteOfDay(instantMs: number, timeZone: string): number {
  const w = wallTime(instantMs, timeZone);
  return w.hour * 60 + w.minute;
}

/**
 * Converts a local wall-clock time (date key + minutes after local midnight)
 * into a UTC instant. Minutes may exceed 1440 to express "next day" times.
 */
export function zonedToUtc(dateKey: string, minuteOfDay: number, timeZone: string): number {
  const extraDays = Math.floor(minuteOfDay / 1440);
  const minutes = minuteOfDay - extraDays * 1440;
  const { year, month, day } = parseDateKey(addDays(dateKey, extraDays));
  const naive = Date.UTC(year, month - 1, day, 0, minutes);
  const first = naive - zoneOffsetMs(naive, timeZone);
  const second = naive - zoneOffsetMs(first, timeZone);
  const matches = [first, second].filter((candidate) => {
    const w = wallTime(candidate, timeZone);
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) === naive && w.second === 0;
  });
  if (matches.length > 0) {
    // Ambiguous (fall-back) times resolve to the earlier instant.
    return Math.min(...matches);
  }
  // Nonexistent (spring-forward gap): move forward by the size of the gap.
  return Math.max(first, second);
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export const TIME = { MINUTE_MS, HOUR_MS: 60 * MINUTE_MS, DAY_MS } as const;
