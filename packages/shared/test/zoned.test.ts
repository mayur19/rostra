import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDateKey,
  isValidDateKey,
  isValidTimeZone,
  isoWeekday,
  localDateKey,
  localMinuteOfDay,
  minutesToHours,
  parseDateKey,
  zoneOffsetMs,
  zonedToUtc,
} from '../src/index.js';

const NY = 'America/New_York';
const iso = (ms: number) => new Date(ms).toISOString();

describe('date keys', () => {
  it('parses and validates calendar dates', () => {
    expect(parseDateKey('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('2026-2-1')).toBe(false);
    expect(() => parseDateKey('nope')).toThrow(RangeError);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(formatDateKey(2026, 1, 5)).toBe('2026-01-05');
  });

  it('counts days between keys in both directions', () => {
    expect(daysBetween('2026-03-02', '2026-03-09')).toBe(7);
    expect(daysBetween('2026-03-09', '2026-03-02')).toBe(-7);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2); // spans US DST start
  });

  it('computes ISO weekdays', () => {
    expect(isoWeekday('2026-03-02')).toBe(1);
    expect(isoWeekday('2026-03-08')).toBe(7);
  });
});

describe('time zones', () => {
  it('recognises valid and invalid zones', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('reports offsets before and after a DST change', () => {
    expect(zoneOffsetMs(Date.parse('2026-03-08T06:00:00Z'), NY)).toBe(-5 * 3_600_000);
    expect(zoneOffsetMs(Date.parse('2026-03-08T08:00:00Z'), NY)).toBe(-4 * 3_600_000);
  });

  it('derives local dates and minutes for instants', () => {
    const lateEvening = Date.parse('2026-03-03T03:30:00Z'); // 22:30 previous day in NY
    expect(localDateKey(lateEvening, NY)).toBe('2026-03-02');
    expect(localMinuteOfDay(lateEvening, NY)).toBe(22 * 60 + 30);
    expect(minutesToHours(90)).toBe(1.5);
  });

  it('converts ordinary wall times', () => {
    expect(iso(zonedToUtc('2026-03-02', 7 * 60, NY))).toBe('2026-03-02T12:00:00.000Z');
    expect(iso(zonedToUtc('2026-07-01', 7 * 60, NY))).toBe('2026-07-01T11:00:00.000Z');
    expect(iso(zonedToUtc('2026-03-02', 9 * 60, 'Asia/Kolkata'))).toBe('2026-03-02T03:30:00.000Z');
  });

  it('supports minutes past midnight for overnight ends', () => {
    expect(iso(zonedToUtc('2026-03-02', 30 * 60, NY))).toBe('2026-03-03T11:00:00.000Z');
  });

  it('moves nonexistent spring-forward times forward', () => {
    // 02:30 does not exist on 2026-03-08 in New York; resolves to 03:30 EDT.
    expect(iso(zonedToUtc('2026-03-08', 150, NY))).toBe('2026-03-08T07:30:00.000Z');
  });

  it('resolves ambiguous fall-back times to the earlier instant', () => {
    // 01:30 happens twice on 2026-11-01; the first is EDT (UTC-4).
    expect(iso(zonedToUtc('2026-11-01', 90, NY))).toBe('2026-11-01T05:30:00.000Z');
  });

  it('round-trips through localDateKey and localMinuteOfDay', () => {
    for (const minute of [0, 59, 61, 179, 181, 23 * 60 + 59]) {
      const instant = zonedToUtc('2026-11-01', minute, NY);
      expect(localDateKey(instant, NY)).toBe('2026-11-01');
      expect(localMinuteOfDay(instant, NY)).toBe(minute);
    }
  });
});
