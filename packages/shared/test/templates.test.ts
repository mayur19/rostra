import { describe, expect, it } from 'vitest';
import { dayLabel, expandTemplates, type ShiftTemplate } from '../src/index.js';

const NY = 'America/New_York';
const night: ShiftTemplate = {
  code: 'N',
  label: 'Night',
  startMinute: 22 * 60,
  durationMinutes: 8 * 60,
  skill: 'RN',
  headcount: 2,
  days: [6, 0],
};

const hours = (s: { start: string; end: string }) =>
  (Date.parse(s.end) - Date.parse(s.start)) / 3_600_000;

describe('expandTemplates', () => {
  it('creates one shift per day in day order with stable ids', () => {
    const shifts = expandTemplates('2026-03-02', NY, [night]);
    expect(shifts.map((s) => s.id)).toEqual(['N-2026-03-02', 'N-2026-03-08']);
    expect(shifts[0]).toMatchObject({ skill: 'RN', headcount: 2, label: 'Night 2026-03-02' });
    expect(shifts[0]?.start).toBe('2026-03-03T03:00:00.000Z');
  });

  it('shortens a night shift that spans the spring-forward change', () => {
    const [shift] = expandTemplates('2026-03-07', NY, [{ ...night, days: [0] }]);
    expect(shift && hours(shift)).toBe(7);
  });

  it('lengthens a night shift that spans the fall-back change', () => {
    const [shift] = expandTemplates('2026-10-31', NY, [{ ...night, days: [0] }]);
    expect(shift && hours(shift)).toBe(9);
  });

  it('keeps day shifts at their wall-clock length', () => {
    const [shift] = expandTemplates('2026-03-08', NY, [
      { ...night, startMinute: 7 * 60, days: [0] },
    ]);
    expect(shift && hours(shift)).toBe(8);
  });

  it('labels weekdays', () => {
    expect(dayLabel(1)).toBe('Mon');
    expect(dayLabel(7)).toBe('Sun');
  });
});
