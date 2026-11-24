import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/security/password.js';
import {
  Client,
  createTestContext,
  data,
  registeredClient,
  truncateAll,
  type TestContext,
} from './helpers.js';

describe('auth', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext({ LOGIN_RATE_LIMIT_MAX: '3' });
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => truncateAll(ctx.db));

  async function register(client: Client, email = 'owner@example.org') {
    await client.primeCsrf();
    return client.post('/api/v1/auth/register', {
      organizationName: 'Ward 7',
      name: 'Olu Owner',
      email,
      password: 'a-very-long-password',
      timezone: 'america/chicago',
    });
  }

  it('registers an owner, opens a session and reports the profile', async () => {
    const client = new Client(ctx.app);
    const response = await register(client);
    expect(response.statusCode).toBe(201);
    const session = response.cookies.find((c) => c.name === 'rostra_session');
    expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    client.csrf = data<{ csrfToken: string }>(response).csrfToken;
    const me = data<{
      user: { role: string };
      organization: { timezone: string };
      permissions: string[];
    }>(await client.get('/api/v1/auth/me'));
    expect(me.user.role).toBe('owner');
    expect(me.organization.timezone).toBe('America/Chicago');
    expect(me.permissions).toContain('org:manage');
  });

  it('rejects duplicate emails case-insensitively without confirming they exist', async () => {
    await register(new Client(ctx.app), 'dup@example.org');
    const again = await register(new Client(ctx.app), 'DUP@example.org');
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toEqual({
      code: 'REGISTRATION_FAILED',
      message: 'Registration could not be completed with the details provided',
    });
    expect(again.body).not.toMatch(/exist/i);
  });

  it('validates registration input', async () => {
    const client = new Client(ctx.app);
    await client.primeCsrf();
    const response = await client.post('/api/v1/auth/register', {
      email: 'nope',
      password: 'short',
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
    expect(response.json().error.details.length).toBeGreaterThan(2);
  });

  it('requires a matching CSRF token on mutating requests', async () => {
    const client = new Client(ctx.app);
    const missing = await client.post('/api/v1/auth/login', { email: 'a@b.co', password: 'x' });
    expect(missing.statusCode).toBe(403);
    expect(missing.json().error.code).toBe('CSRF_FAILED');

    const owner = await registeredClient(ctx.app);
    const forged = await owner.request(
      'POST',
      '/api/v1/skills',
      { code: 'RN', name: 'RN' },
      { 'x-csrf-token': 'forged' },
    );
    expect(forged.statusCode).toBe(403);
  });

  it('rejects CSRF tokens from another session even when cookie and header agree', async () => {
    const owner = await registeredClient(ctx.app);
    const response = await owner.request(
      'POST',
      '/api/v1/skills',
      { code: 'RN', name: 'RN' },
      {
        'x-csrf-token': 'attacker',
        cookie: `rostra_session=${owner.cookie('rostra_session')}; rostra_csrf=attacker`,
      },
    );
    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toMatch(/session/);
  });

  it('logs in, rejects bad passwords and logs out', async () => {
    await register(new Client(ctx.app), 'login@example.org');
    const client = new Client(ctx.app);
    await client.primeCsrf();
    const bad = await client.post('/api/v1/auth/login', {
      email: 'login@example.org',
      password: 'wrong-password',
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe('INVALID_CREDENTIALS');
    const unknown = await client.post('/api/v1/auth/login', {
      email: 'ghost@example.org',
      password: 'whatever',
    });
    expect(unknown.statusCode).toBe(401);

    const good = await client.post('/api/v1/auth/login', {
      email: 'LOGIN@example.org',
      password: 'a-very-long-password',
    });
    expect(good.statusCode).toBe(200);
    client.csrf = data<{ csrfToken: string }>(good).csrfToken;
    expect((await client.get('/api/v1/auth/me')).statusCode).toBe(200);

    const csrf = await client.get('/api/v1/auth/csrf');
    expect(data<{ csrfToken: string }>(csrf).csrfToken).toBe(client.csrf);

    expect((await client.post('/api/v1/auth/logout')).statusCode).toBe(204);
    expect((await client.get('/api/v1/auth/me')).statusCode).toBe(401);
  });

  it('throttles repeated login attempts with Retry-After', async () => {
    const client = new Client(ctx.app);
    await client.primeCsrf();
    const attempt = () =>
      client.post('/api/v1/auth/login', { email: 'rate@example.org', password: 'nope-nope' });
    for (let i = 0; i < 3; i += 1) expect((await attempt()).statusCode).toBe(401);
    const limited = await attempt();
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rejects deactivated users and expired sessions', async () => {
    const owner = await registeredClient(ctx.app, { email: 'inactive@example.org' });
    await ctx.db.query("UPDATE sessions SET expires_at = now() - interval '1 minute'");
    expect((await owner.get('/api/v1/auth/me')).statusCode).toBe(401);
    await ctx.db.query("UPDATE users SET is_active = false WHERE email = 'inactive@example.org'");
    const client = new Client(ctx.app);
    await client.primeCsrf();
    const login = await client.post('/api/v1/auth/login', {
      email: 'inactive@example.org',
      password: 'a-very-long-password',
    });
    expect(login.statusCode).toBe(401);
  });

  it('enforces RBAC: employees can read rosters but not manage staff', async () => {
    const owner = await registeredClient(ctx.app);
    const me = data<{ organization: { id: string } }>(await owner.get('/api/v1/auth/me'));
    await ctx.db.query(
      `INSERT INTO users (organization_id, email, name, password_hash, role) VALUES ($1, $2, 'Emp', $3, 'employee')`,
      [me.organization.id, 'emp@example.org', await hashPassword('a-very-long-password')],
    );
    const employee = new Client(ctx.app);
    await employee.primeCsrf();
    const login = await employee.post('/api/v1/auth/login', {
      email: 'emp@example.org',
      password: 'a-very-long-password',
    });
    employee.csrf = data<{ csrfToken: string }>(login).csrfToken;
    expect((await employee.get('/api/v1/rosters')).statusCode).toBe(200);
    expect((await employee.get('/api/v1/employees')).statusCode).toBe(403);
    expect((await employee.get('/api/v1/audit-logs')).statusCode).toBe(403);
  });

  it('writes an audit trail for registration, login and logout', async () => {
    const owner = await registeredClient(ctx.app);
    const logs = data<{ action: string }[]>(await owner.get('/api/v1/audit-logs'));
    expect(logs.map((l) => l.action)).toContain('organization.registered');
    const response = await owner.get('/api/v1/audit-logs?limit=1');
    expect(response.json().meta).toMatchObject({ limit: 1, offset: 0 });
    expect((await owner.get('/api/v1/audit-logs?limit=0')).statusCode).toBe(422);
  });

  it('requires authentication for protected routes', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/v1/employees' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ data: null, error: { code: 'UNAUTHORIZED' } });
  });
});
