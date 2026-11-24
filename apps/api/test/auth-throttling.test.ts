import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, trustProxySchema } from '../src/config/env.js';
import { toFastifyTrustProxy } from '../src/app.js';
import { createBackoffLimiter } from '../src/security/rate-limiter.js';
import { createTestContext, truncateAll, type TestContext } from './helpers.js';

const CSRF = { cookie: 'rostra_csrf=t', 'x-csrf-token': 't' };

function login(
  ctx: TestContext,
  email: string,
  remoteAddress: string,
  extra: Record<string, string> = {},
) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    remoteAddress,
    headers: { ...CSRF, ...extra },
    payload: { email, password: 'wrong-password' },
  });
}

function register(ctx: TestContext, email: string, remoteAddress: string) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    remoteAddress,
    headers: CSRF,
    payload: { organizationName: 'Ward', name: 'O', email, password: 'a-very-long-password' },
  });
}

describe('login and registration throttling', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext({
      LOGIN_RATE_LIMIT_MAX: '100',
      LOGIN_IP_RATE_LIMIT_MAX: '4',
      LOGIN_EMAIL_FREE_ATTEMPTS: '3',
      LOGIN_EMAIL_BACKOFF_BASE_MS: '10000',
      REGISTER_RATE_LIMIT_MAX: '2',
    });
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => truncateAll(ctx.db));

  it('ignores X-Forwarded-For by default so rotating it cannot evade the per-IP limit', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await login(ctx, `spray${i}@example.org`, '203.0.113.9', {
        'x-forwarded-for': `198.51.100.${i}`,
      });
      codes.push(response.statusCode);
    }
    expect(codes).toEqual([401, 401, 401, 401, 429]);
  });

  it('locks an email with progressive backoff across many source IPs', async () => {
    const codes: number[] = [];
    // Three free failures, then the fourth failure starts the lockout.
    for (let i = 0; i < 4; i += 1)
      codes.push((await login(ctx, 'victim@example.org', `192.0.2.${i}`)).statusCode);
    expect(codes).toEqual([401, 401, 401, 401]);
    const locked = await login(ctx, 'victim@example.org', '192.0.2.50');
    expect(locked.statusCode).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBe(10);
    // Other emails from a fresh address are unaffected.
    expect((await login(ctx, 'someone-else@example.org', '192.0.2.99')).statusCode).toBe(401);
  });

  it('rate-limits registrations per IP', async () => {
    expect((await register(ctx, 'a@example.org', '198.51.100.20')).statusCode).toBe(201);
    expect((await register(ctx, 'b@example.org', '198.51.100.20')).statusCode).toBe(201);
    const limited = await register(ctx, 'c@example.org', '198.51.100.20');
    expect(limited.statusCode).toBe(429);
    expect((await register(ctx, 'c@example.org', '198.51.100.21')).statusCode).toBe(201);
  });
});

describe('trusted proxies', () => {
  it('uses X-Forwarded-For only when the proxy is configured', async () => {
    const ctx = await createTestContext({
      TRUST_PROXY: '127.0.0.1',
      LOGIN_IP_RATE_LIMIT_MAX: '1',
      LOGIN_RATE_LIMIT_MAX: '100',
    });
    const first = await login(ctx, 'p1@example.org', '127.0.0.1', {
      'x-forwarded-for': '198.51.100.1',
    });
    const second = await login(ctx, 'p2@example.org', '127.0.0.1', {
      'x-forwarded-for': '198.51.100.2',
    });
    const repeat = await login(ctx, 'p3@example.org', '127.0.0.1', {
      'x-forwarded-for': '198.51.100.1',
    });
    expect([first.statusCode, second.statusCode, repeat.statusCode]).toEqual([401, 401, 429]);
    // An untrusted peer cannot inject a forwarded address.
    const spoofed = await login(ctx, 'p4@example.org', '203.0.113.7', {
      'x-forwarded-for': '198.51.100.99',
    });
    const again = await login(ctx, 'p5@example.org', '203.0.113.7', {
      'x-forwarded-for': '198.51.100.98',
    });
    expect([spoofed.statusCode, again.statusCode]).toEqual([401, 429]);
    await ctx.close();
  });

  it('parses TRUST_PROXY values and rejects trusting everyone', () => {
    expect(trustProxySchema.parse(undefined)).toBe(false);
    expect(trustProxySchema.parse('false')).toBe(false);
    expect(trustProxySchema.parse('2')).toBe(2);
    expect(trustProxySchema.parse('127.0.0.1, 10.0.0.0/8')).toEqual(['127.0.0.1', '10.0.0.0/8']);
    expect(trustProxySchema.safeParse('true').success).toBe(false);
    expect(trustProxySchema.safeParse('evil.example.com').success).toBe(false);
    expect(() =>
      loadConfig({ DATABASE_URL: 'x', SESSION_SECRET: 's'.repeat(32), TRUST_PROXY: 'true' }),
    ).toThrow(/TRUST_PROXY/);
  });

  it('maps hop counts to a hop predicate', () => {
    const trust = toFastifyTrustProxy(1);
    expect(typeof trust === 'function' && trust('10.0.0.1', 0)).toBe(true);
    expect(typeof trust === 'function' && trust('10.0.0.1', 1)).toBe(false);
    expect(toFastifyTrustProxy(false)).toBe(false);
  });
});

describe('createBackoffLimiter', () => {
  const limiter = () =>
    createBackoffLimiter({ freeAttempts: 2, baseDelayMs: 1000, maxDelayMs: 8000, maxKeys: 2 });

  it('doubles the lockout per failure beyond the free attempts, up to the cap', () => {
    const l = limiter();
    l.fail('k', 0);
    l.fail('k', 0);
    expect(l.check('k', 0)).toBe(0);
    const delays = [1, 2, 4, 8, 8];
    for (const expected of delays) {
      l.fail('k', 0);
      expect(l.check('k', 0)).toBe(expected);
    }
    expect(l.check('k', 8000)).toBe(0);
  });

  it('resets on success and forgets quiet keys', () => {
    const l = limiter();
    for (let i = 0; i < 4; i += 1) l.fail('k', 0);
    l.reset('k');
    expect(l.check('k', 0)).toBe(0);
    for (let i = 0; i < 4; i += 1) l.fail('q', 0);
    expect(l.check('q', 16_000)).toBe(0);
    l.fail('q', 16_000);
    expect(l.check('q', 16_000)).toBe(0);
    l.fail('a', 40_000);
    l.fail('b', 40_000);
    expect(l.check('a', 40_000)).toBe(0);
  });
});
