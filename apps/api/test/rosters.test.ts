import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  data,
  registeredClient,
  truncateAll,
  type Client,
  type TestContext,
} from './helpers.js';

const contract = {
  minHoursPerWeek: 0,
  maxHoursPerWeek: 40,
  maxConsecutiveDays: 5,
  minRestHours: 11,
};
const WEEK = '2026-03-02';

interface Schedule {
  roster: { id: string; version: number };
  shifts: { id: string; label: string }[];
  assignments: { shiftId: string; employeeId: string; pinned: boolean; source: string }[];
  evaluation: {
    feasible: boolean;
    score: { hard: number; soft: number };
    violations: { constraint: string; message: string }[];
    metrics: { slotsTotal: number; slotsFilled: number };
  };
}

async function setupWard(client: Client) {
  await client.post('/api/v1/skills', { code: 'RN', name: 'Registered Nurse' });
  const employees: string[] = [];
  for (const name of ['Ava', 'Ben', 'Cy', 'Di']) {
    const response = await client.post('/api/v1/employees', {
      name,
      hourlyRateMinor: 4000,
      contract,
      skills: [{ skill: 'RN' }],
    });
    employees.push(data<{ id: string }>(response).id);
  }
  const roster = data<{ id: string }>(
    await client.post('/api/v1/rosters', {
      name: 'Week 10',
      weekStart: WEEK,
      timezone: 'America/New_York',
    }),
  );
  const shifts: string[] = [];
  for (let day = 0; day < 7; day += 1) {
    const date = `2026-03-0${2 + day}`;
    const start = day === 6 ? '2026-03-08T11:00:00Z' : `${date}T12:00:00Z`; // 07:00 local, DST on Sunday
    const end = new Date(Date.parse(start) + 8 * 3_600_000).toISOString();
    const response = await client.post(`/api/v1/rosters/${roster.id}/shifts`, {
      label: `Day ${date}`,
      start,
      end,
      skill: 'RN',
      headcount: 2,
    });
    if (response.statusCode !== 201) throw new Error(response.body);
    shifts.push(data<{ id: string }>(response).id);
  }
  return { rosterId: roster.id, employees, shifts };
}

describe('rosters and solver', () => {
  let ctx: TestContext;
  let owner: Client;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await truncateAll(ctx.db);
    owner = await registeredClient(ctx.app);
  });

  it('creates rosters and validates shifts against the roster week', async () => {
    const { rosterId } = await setupWard(owner);
    const roster = data<{ shiftCount: number; weekStart: string; timezone: string }>(
      await owner.get(`/api/v1/rosters/${rosterId}`),
    );
    expect(roster).toMatchObject({ shiftCount: 7, weekStart: WEEK, timezone: 'America/New_York' });
    expect(data<unknown[]>(await owner.get('/api/v1/rosters'))).toHaveLength(1);
    const outside = await owner.post(`/api/v1/rosters/${rosterId}/shifts`, {
      label: 'Late',
      start: '2026-03-09T12:00:00Z',
      end: '2026-03-09T20:00:00Z',
      skill: 'RN',
      headcount: 1,
    });
    expect(outside.statusCode).toBe(422);
    const unknownSkill = await owner.post(`/api/v1/rosters/${rosterId}/shifts`, {
      label: 'ICU',
      start: '2026-03-03T12:00:00Z',
      end: '2026-03-03T20:00:00Z',
      skill: 'ICU',
      headcount: 1,
    });
    expect(unknownSkill.statusCode).toBe(422);
    const shifts = data<{ start: string; end: string }[]>(
      await owner.get(`/api/v1/rosters/${rosterId}/shifts`),
    );
    expect(shifts[6]).toEqual(
      expect.objectContaining({ start: '2026-03-08T11:00:00Z', end: '2026-03-08T19:00:00Z' }),
    );
  });

  it('solves a week, persists assignments and records the run', async () => {
    const { rosterId } = await setupWard(owner);
    const response = await owner.post(`/api/v1/rosters/${rosterId}/solve`, {
      seed: 7,
      iterations: 5000,
    });
    expect(response.statusCode).toBe(200);
    const { run, schedule } = data<{
      run: { seed: number; hardScore: number; coverageRatio: number };
      schedule: Schedule;
    }>(response);
    expect(run).toMatchObject({ seed: 7, hardScore: 0, coverageRatio: 1 });
    expect(schedule.evaluation.feasible).toBe(true);
    expect(schedule.assignments).toHaveLength(14);
    expect(schedule.assignments.every((a) => a.source === 'solver' && !a.pinned)).toBe(true);
    expect(schedule.roster.version).toBeGreaterThan(1);

    const stored = data<Schedule>(await owner.get(`/api/v1/rosters/${rosterId}/schedule`));
    expect(stored.assignments).toEqual(schedule.assignments);
    const runs = data<unknown[]>(await owner.get(`/api/v1/rosters/${rosterId}/solver-runs`));
    expect(runs).toHaveLength(1);
    const audit = data<{ action: string }[]>(await owner.get('/api/v1/audit-logs'));
    expect(audit.map((a) => a.action)).toContain('roster.solved');
  });

  it('is reproducible: the same seed yields the same roster', async () => {
    const { rosterId } = await setupWard(owner);
    const first = data<{ schedule: Schedule }>(
      await owner.post(`/api/v1/rosters/${rosterId}/solve`, { seed: 3, iterations: 3000 }),
    );
    const second = data<{ schedule: Schedule }>(
      await owner.post(`/api/v1/rosters/${rosterId}/solve`, { seed: 3, iterations: 3000 }),
    );
    const key = (s: Schedule) => s.assignments.map((a) => `${a.shiftId}:${a.employeeId}`).sort();
    expect(key(second.schedule)).toEqual(key(first.schedule));
  });

  it('keeps pinned assignments when re-solving', async () => {
    const { rosterId, employees, shifts } = await setupWard(owner);
    const pin = { shiftId: shifts[0] as string, employeeId: employees[3] as string, pinned: true };
    const saved = await owner.put(`/api/v1/rosters/${rosterId}/assignments`, {
      assignments: [pin],
    });
    expect(saved.statusCode).toBe(200);
    const solved = data<{ schedule: Schedule }>(
      await owner.post(`/api/v1/rosters/${rosterId}/solve`, { seed: 1, iterations: 2000 }),
    );
    expect(solved.schedule.assignments).toContainEqual({ ...pin, source: 'manual' });
    expect(solved.schedule.assignments.filter((a) => a.shiftId === shifts[0])).toHaveLength(2);

    const unpinned = data<{ schedule: Schedule }>(
      await owner.post(`/api/v1/rosters/${rosterId}/solve`, {
        seed: 1,
        iterations: 2000,
        keepPinned: false,
      }),
    );
    expect(unpinned.schedule.assignments.some((a) => a.pinned)).toBe(false);
  });

  it('evaluates proposed edits without saving them', async () => {
    const { rosterId, employees, shifts } = await setupWard(owner);
    const proposal = [
      { shiftId: shifts[0], employeeId: employees[0] },
      { shiftId: shifts[0], employeeId: employees[1] },
    ];
    const response = await owner.post(`/api/v1/rosters/${rosterId}/evaluate`, {
      assignments: proposal,
    });
    const evaluation = data<Schedule['evaluation']>(response);
    expect(evaluation.metrics).toMatchObject({ slotsTotal: 14, slotsFilled: 2 });
    expect(evaluation.violations[0]?.constraint).toBe('UNFILLED_SLOT');
    const stored = data<Schedule>(await owner.get(`/api/v1/rosters/${rosterId}/schedule`));
    expect(stored.assignments).toEqual([]);
  });

  it('rejects invalid manual assignments', async () => {
    const { rosterId, employees, shifts } = await setupWard(owner);
    const duplicate = await owner.put(`/api/v1/rosters/${rosterId}/assignments`, {
      assignments: [
        { shiftId: shifts[0], employeeId: employees[0], pinned: false },
        { shiftId: shifts[0], employeeId: employees[0], pinned: false },
      ],
    });
    expect(duplicate.statusCode).toBe(422);
    const overHeadcount = await owner.put(`/api/v1/rosters/${rosterId}/assignments`, {
      assignments: employees
        .slice(0, 3)
        .map((employeeId) => ({ shiftId: shifts[0], employeeId, pinned: false })),
    });
    expect(overHeadcount.statusCode).toBe(422);
    expect(overHeadcount.json().error.code).toBe('INVALID_PROBLEM');
    const foreign = await owner.post(`/api/v1/rosters/${rosterId}/evaluate`, {
      assignments: [{ shiftId: shifts[0], employeeId: '00000000-0000-4000-8000-000000000000' }],
    });
    expect(foreign.statusCode).toBe(422);
  });

  it('deletes shifts and blocks changes to published rosters', async () => {
    const { rosterId, shifts } = await setupWard(owner);
    expect((await owner.delete(`/api/v1/rosters/${rosterId}/shifts/${shifts[0]}`)).statusCode).toBe(
      204,
    );
    expect((await owner.delete(`/api/v1/rosters/${rosterId}/shifts/${shifts[0]}`)).statusCode).toBe(
      404,
    );
    await ctx.db.query("UPDATE rosters SET status = 'published' WHERE id = $1", [rosterId]);
    const solve = await owner.post(`/api/v1/rosters/${rosterId}/solve`, {});
    expect(solve.statusCode).toBe(409);
    expect((await owner.delete(`/api/v1/rosters/${rosterId}/shifts/${shifts[1]}`)).statusCode).toBe(
      409,
    );
  });

  it('serializes concurrent solves of the same roster', async () => {
    const { rosterId } = await setupWard(owner);
    const responses = await Promise.all([
      owner.post(`/api/v1/rosters/${rosterId}/solve`, { seed: 1, iterations: 2000 }),
      owner.post(`/api/v1/rosters/${rosterId}/solve`, { seed: 2, iterations: 2000 }),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    const stored = data<Schedule>(await owner.get(`/api/v1/rosters/${rosterId}/schedule`));
    expect(stored.assignments).toHaveLength(14);
    expect(
      data<unknown[]>(await owner.get(`/api/v1/rosters/${rosterId}/solver-runs`)),
    ).toHaveLength(2);
  });

  it('explains unfillable demand when staff are unavailable', async () => {
    const { rosterId, employees } = await setupWard(owner);
    for (const id of employees.slice(1)) {
      await owner.patch(`/api/v1/employees/${id}`, {
        unavailability: [
          { start: '2026-03-02T00:00:00Z', end: '2026-03-10T00:00:00Z', reason: 'time_off' },
        ],
      });
    }
    const { schedule } = data<{ schedule: Schedule }>(
      await owner.post(`/api/v1/rosters/${rosterId}/solve`, { seed: 1, iterations: 1000 }),
    );
    expect(schedule.evaluation.feasible).toBe(false);
    expect(schedule.evaluation.violations.map((v) => v.constraint)).toContain('UNFILLED_SLOT');
  });

  it('isolates rosters between organizations and lists constraints', async () => {
    const { rosterId } = await setupWard(owner);
    const other = await registeredClient(ctx.app);
    expect((await other.get(`/api/v1/rosters/${rosterId}`)).statusCode).toBe(404);
    expect((await other.post(`/api/v1/rosters/${rosterId}/solve`, {})).statusCode).toBe(404);
    expect((await other.get(`/api/v1/rosters/${rosterId}/shifts`)).statusCode).toBe(404);
    const catalog = data<{ constraints: unknown[] }>(await other.get('/api/v1/constraints'));
    expect(catalog.constraints).toHaveLength(14);
  });
});
