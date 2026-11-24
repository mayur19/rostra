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
  minHoursPerWeek: 24,
  maxHoursPerWeek: 40,
  maxConsecutiveDays: 5,
  minRestHours: 11,
};

describe('skills and employees', () => {
  let ctx: TestContext;
  let owner: Client;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await truncateAll(ctx.db);
    owner = await registeredClient(ctx.app);
    await owner.post('/api/v1/skills', { code: 'RN', name: 'Registered Nurse' });
    await owner.post('/api/v1/skills', { code: 'CNA', name: 'Nursing Assistant' });
  });

  it('lists skills and rejects duplicates', async () => {
    expect(data<{ code: string }[]>(await owner.get('/api/v1/skills')).map((s) => s.code)).toEqual([
      'CNA',
      'RN',
    ]);
    expect((await owner.post('/api/v1/skills', { code: 'RN', name: 'Again' })).statusCode).toBe(
      409,
    );
    expect((await owner.post('/api/v1/skills', { code: 'rn', name: 'Lower' })).statusCode).toBe(
      422,
    );
  });

  it('creates an employee with skills, unavailability and defaults', async () => {
    const response = await owner.post('/api/v1/employees', {
      name: 'Ava Patel',
      hourlyRateMinor: 4200,
      contract,
      skills: [{ skill: 'RN', expiresOn: '2027-01-31' }],
      unavailability: [
        { start: '2026-03-03T00:00:00Z', end: '2026-03-04T00:00:00Z', reason: 'time_off' },
      ],
      preferences: { preferredDaysOff: [7], avoidNights: true },
    });
    expect(response.statusCode).toBe(201);
    expect(data(response)).toMatchObject({
      name: 'Ava Patel',
      hourlyRateMinor: 4200,
      contract: { ...contract, overtimeAfterHours: 40, maxShiftsPerDay: 1 },
      skills: [{ skill: 'RN', expiresOn: '2027-01-31' }],
      unavailability: [
        { start: '2026-03-03T00:00:00Z', end: '2026-03-04T00:00:00Z', reason: 'time_off' },
      ],
      preferences: { preferredDaysOff: [7], avoidNights: true },
      version: 1,
    });
  });

  it('rejects unknown skills and invalid contracts', async () => {
    const unknown = await owner.post('/api/v1/employees', {
      name: 'X',
      hourlyRateMinor: 1,
      contract,
      skills: [{ skill: 'ICU' }],
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json().error.details[0].message).toBe('Unknown skill ICU');
    const inverted = await owner.post('/api/v1/employees', {
      name: 'X',
      hourlyRateMinor: 1,
      contract: { ...contract, minHoursPerWeek: 60 },
    });
    expect(inverted.statusCode).toBe(422);
  });

  it('paginates the employee list', async () => {
    for (const name of ['Cara', 'Abe', 'Bo']) {
      await owner.post('/api/v1/employees', { name, hourlyRateMinor: 3000, contract });
    }
    const page = await owner.get('/api/v1/employees?limit=2&offset=1');
    expect(data<{ name: string }[]>(page).map((e) => e.name)).toEqual(['Bo', 'Cara']);
    expect(page.json().meta).toEqual({ total: 3, limit: 2, offset: 1 });
  });

  it('gets, patches and versions an employee', async () => {
    const created = data<{ id: string }>(
      await owner.post('/api/v1/employees', {
        name: 'Dev',
        hourlyRateMinor: 3000,
        contract,
        skills: [{ skill: 'RN' }],
      }),
    );
    const patched = await owner.patch(`/api/v1/employees/${created.id}`, {
      hourlyRateMinor: 3500,
      skills: [{ skill: 'CNA', expiresOn: null }],
    });
    expect(patched.statusCode).toBe(200);
    expect(data(patched)).toMatchObject({
      name: 'Dev',
      hourlyRateMinor: 3500,
      skills: [{ skill: 'CNA' }],
      version: 2,
    });
    const invalid = await owner.patch(`/api/v1/employees/${created.id}`, {
      contract: { ...contract, minHoursPerWeek: 50, maxHoursPerWeek: 40 },
    });
    expect(invalid.statusCode).toBe(422);
    expect((await owner.get(`/api/v1/employees/${created.id}`)).statusCode).toBe(200);
  });

  it('returns 404 for missing employees and 422 for malformed ids', async () => {
    expect(
      (await owner.get('/api/v1/employees/00000000-0000-4000-8000-000000000000')).statusCode,
    ).toBe(404);
    expect(
      (await owner.patch('/api/v1/employees/00000000-0000-4000-8000-000000000000', { name: 'x' }))
        .statusCode,
    ).toBe(404);
    expect((await owner.get('/api/v1/employees/not-a-uuid')).statusCode).toBe(422);
  });

  it('isolates tenants', async () => {
    const created = data<{ id: string }>(
      await owner.post('/api/v1/employees', { name: 'Mine', hourlyRateMinor: 1, contract }),
    );
    const other = await registeredClient(ctx.app);
    expect((await other.get(`/api/v1/employees/${created.id}`)).statusCode).toBe(404);
    expect(data<unknown[]>(await other.get('/api/v1/employees'))).toEqual([]);
    expect(data<unknown[]>(await other.get('/api/v1/skills'))).toEqual([]);
  });
});
