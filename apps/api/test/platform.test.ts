import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env.js';
import { createRateLimiter } from '../src/security/rate-limiter.js';
import { hashPassword, verifyPassword } from '../src/security/password.js';
import { hashToken, randomToken, safeEqual } from '../src/security/tokens.js';
import { createTestContext, type TestContext } from './helpers.js';

describe('platform endpoints', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => ctx.close());

  it('reports health and readiness', async () => {
    const health = await ctx.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ data: { status: 'ok' }, error: null });
    const ready = await ctx.app.inject({ method: 'GET', url: '/api/v1/ready' });
    expect(ready.json().data).toMatchObject({ status: 'ready', database: 'up', migrations: 3 });
  });

  it('echoes safe request ids and replaces unsafe ones', async () => {
    const echoed = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(echoed.headers['x-request-id']).toBe('abc-123');
    const replaced = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'bad id<script>' },
    });
    expect(replaced.headers['x-request-id']).not.toBe('bad id<script>');
    expect(replaced.headers['x-content-type-options']).toBe('nosniff');
  });

  it('wraps unknown routes in the error envelope', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ data: null, error: { code: 'NOT_FOUND' } });
  });

  it('answers pending endpoints with 501 and their backlog ticket', async () => {
    for (const [method, url, ticket] of [
      ['POST', '/api/v1/rosters/00000000-0000-0000-0000-000000000000/publish', 'RO-170'],
      ['GET', '/api/v1/timesheets', 'RO-200'],
      ['POST', '/api/v1/payroll-exports', 'RO-210'],
    ] as const) {
      const response = await ctx.app.inject({ method, url });
      expect(response.statusCode).toBe(501);
      expect(response.json().error).toMatchObject({ code: 'NOT_IMPLEMENTED', details: { ticket } });
    }
  });

  it('rejects malformed JSON bodies as client errors', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });
});

describe('readiness without a database', () => {
  it('returns 503 when the database is unreachable', async () => {
    const ctx = await createTestContext({
      DATABASE_URL: 'postgresql://localhost:1/none?host=/nonexistent',
    });
    const response = await ctx.app.inject({ method: 'GET', url: '/api/v1/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('NOT_READY');
    await ctx.close();
  });
});

describe('config', () => {
  const base = { DATABASE_URL: 'postgresql://x/y', SESSION_SECRET: 's'.repeat(32) };

  it('applies defaults', () => {
    expect(loadConfig(base)).toMatchObject({
      API_PORT: 4108,
      NODE_ENV: 'development',
      COOKIE_SECURE: false,
    });
  });

  it('fails fast listing every problem', () => {
    expect(() => loadConfig({ SESSION_SECRET: 'short' })).toThrow(/DATABASE_URL.*SESSION_SECRET/);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(
      loadConfig({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'true' }).COOKIE_SECURE,
    ).toBe(true);
  });
});

describe('security primitives', () => {
  it('hashes and verifies passwords with scrypt', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });

  it('creates random tokens and keyed hashes', () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(hashToken('t', 'k')).toBe(hashToken('t', 'k'));
    expect(hashToken('t', 'k')).not.toBe(hashToken('t', 'other'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('throttles after the limit and resets after the window', () => {
    const limiter = createRateLimiter(2, 1000, 2);
    expect(limiter.hit('k', 0)).toBe(0);
    expect(limiter.hit('k', 10)).toBe(0);
    expect(limiter.hit('k', 20)).toBe(1);
    expect(limiter.hit('k', 1000)).toBe(0);
    limiter.reset('k');
    expect(limiter.hit('other', 5000)).toBe(0);
    expect(limiter.hit('third', 9000)).toBe(0);
  });
});
