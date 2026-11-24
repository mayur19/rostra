import { describe, expect, it } from 'vitest';
import { buildGrid, timeRange } from '../src/roster/grid-model';
import { TZ, WEEK, assignments, employees, shifts, violations } from './fixtures';

describe('buildGrid', () => {
  const grid = buildGrid({
    weekStart: WEEK,
    timezone: TZ,
    shifts,
    employees,
    assignments,
    violations,
  });

  it('lays out seven local dates', () => {
    expect(grid.dates).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });

  it('places shifts on their local start date and sums hours', () => {
    const ava = grid.rows[0]!;
    expect(ava.hours).toBe(16);
    expect(ava.days[0]?.[0]).toMatchObject({ shiftId: 's-mon', time: '07:00-15:00', pinned: true });
    // 03:00Z on Mar 9 is 23:00 on Sunday Mar 8 in New York (after DST began).
    expect(ava.days[6]?.[0]).toMatchObject({ shiftId: 's-sun', time: '23:00-07:00' });
  });

  it('flags cells named by hard violations for that employee only', () => {
    expect(grid.rows[1]?.days[1]?.[0]?.flagged).toBe(true);
    expect(grid.rows[0]?.days[6]?.[0]?.flagged).toBe(false);
    expect(grid.rows[1]?.violationCount).toBe(1);
  });

  it('lists open slots by date', () => {
    expect(grid.openSlots).toEqual([
      { date: '2026-03-02', label: 'Day RN 2026-03-02', missing: 1 },
    ]);
  });

  it('formats a local time range', () => {
    expect(timeRange(shifts[2]!, 'UTC')).toBe('12:00-20:00');
  });
});
