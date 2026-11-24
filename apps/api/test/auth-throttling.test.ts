import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, trustProxySchema } from '../src/config/env.js';
import { toFastifyTrustProxy } from '../src/app.js';
import { ipKey } from '../src/security/ip-key.js';
import {
  createBackoffLimiter,
  createDistinctKeyLimiter,
  createRateLimiter,
} from '../src/security/rate-limiter.js';
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

  it('counts concurrent attempts for one email atomically', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, i) => login(ctx, 'burst@example.org', `192.0.2.${100 + i}`)),
    );
    const codes = attempts.map((r) => r.statusCode).sort();
    // Three free attempts plus the one that starts the lockout reach the password check.
    expect(codes.filter((c) => c === 401)).toHaveLength(4);
    expect(codes.filter((c) => c === 429)).toHaveLength(6);
  });

  it('treats addresses within one IPv6 /64 as a single client', async () => {
    const codes: number[] = [];
    for (let i = 1; i <= 5; i += 1) {
      codes.push(
        (await login(ctx, `v6-${i}@example.org`, `2001:db8:1:2::${i.toString(16)}`)).statusCode,
      );
    }
    expect(codes).toEqual([401, 401, 401, 401, 429]);
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
    createBackoffLimiter({ freeAttempts: 2, baseDelayMs: 1000, maxDelayMs: 8000, maxKeys: 3 });

  it('doubles the lockout per attempt beyond the free ones, up to the cap', () => {
    const l = limiter();
    expect([l.attempt('k', 0), l.attempt('k', 0)]).toEqual([0, 0]);
    const waits: number[] = [];
    let now = 0;
    for (let i = 0; i < 5; i += 1) {
      expect(l.attempt('k', now)).toBe(0);
      waits.push(l.attempt('k', now));
      now += waits[waits.length - 1]! * 1000;
    }
    expect(waits).toEqual([1, 2, 4, 8, 8]);
  });

  it('rejects without recording while locked, resets on success and forgets quiet keys', () => {
    const l = limiter();
    for (let i = 0; i < 3; i += 1) l.attempt('k', 0);
    expect(l.attempt('k', 500)).toBe(1);
    expect(l.attempt('k', 1000)).toBe(0); // lock expired; this attempt locks for 2s
    expect(l.attempt('k', 1000)).toBe(2);
    l.reset('k');
    expect(l.attempt('k', 1000)).toBe(0);
    for (let i = 0; i < 4; i += 1) l.attempt('q', 0);
    expect(l.attempt('q', 16_000)).toBe(0);
  });

  it('enforces a hard key cap by evicting the oldest keys', () => {
    const l = limiter();
    for (const key of ['a', 'b', 'c', 'd', 'e']) l.attempt(key, 0);
    expect(l.size).toBe(3);
  });
});

describe('createRateLimiter key cap and pruning', () => {
  it('never holds more than maxKeys entries', () => {
    const limiter = createRateLimiter(1, 1000, 100);
    for (let i = 0; i < 10_000; i += 1) limiter.hit(`k${i}`, 0);
    expect(limiter.size).toBe(100);
  });

  it('prunes expired windows in amortised batches', () => {
    const limiter = createRateLimiter(1, 1000, 100_000);
    for (let i = 0; i < 300; i += 1) limiter.hit(`old${i}`, 0);
    for (let i = 0; i < 256; i += 1) limiter.hit(`new${i}`, 5000);
    expect(limiter.size).toBeLessThan(556);
  });

  it('keeps recently touched keys when evicting', () => {
    const limiter = createRateLimiter(1, 60_000, 2);
    limiter.hit('victim', 0);
    limiter.hit('other', 1);
    limiter.hit('victim', 2); // touched again: now newest
    limiter.hit('third', 3); // evicts "other", not "victim"
    expect(limiter.hit('victim', 4)).toBeGreaterThan(0);
  });
});

describe('limiter store saturation', () => {
  it('does not let one source evict an active lockout by flooding new keys', () => {
    const limiter = createRateLimiter(1, 60_000, 50);
    limiter.hit('locked', 0);
    expect(limiter.hit('locked', 1)).toBeGreaterThan(0);
    // Flood with inactive (under-limit) keys: they are evicted before any active entry.
    for (let i = 0; i < 10_000; i += 1) limiter.hit(`flood${i}`, 2);
    expect(limiter.hit('locked', 3)).toBeGreaterThan(0);
  });

  it('still admits new users when every slot holds an active lockout', () => {
    const evictions: number[] = [];
    const l = createBackoffLimiter({
      freeAttempts: 1,
      baseDelayMs: 1000,
      maxDelayMs: 600_000,
      maxKeys: 2,
      onForcedEviction: (total) => evictions.push(total),
    });
    l.attempt('long', 0);
    l.attempt('long', 0);
    l.attempt('long', 1000);
    l.attempt('long', 1000); // locked for 2 s
    l.attempt('short', 0);
    l.attempt('short', 0); // locked for 1 s
    expect(l.attempt('newcomer', 100)).toBe(0);
    expect(evictions).toEqual([1]);
    // The entry with the least lock time remaining ("short") was the one evicted.
    expect(l.attempt('long', 200)).toBeGreaterThan(0);
    expect(l.size).toBe(2);
  });

  it('keeps a victim locked out after a flood evicts its map entry (sketch layer)', () => {
    const evictions: number[] = [];
    const l = createBackoffLimiter({
      freeAttempts: 1,
      baseDelayMs: 60_000,
      maxDelayMs: 600_000,
      maxKeys: 10,
      onForcedEviction: (total) => evictions.push(total),
    });
    l.attempt('victim', 0);
    l.attempt('victim', 0); // locked until 60 s
    // Flood with keys locked for longer, so the victim has the least time remaining.
    for (let i = 0; i < 200; i += 1) {
      for (let k = 0; k < 3; k += 1) l.attempt(`flood${i}`, 1000 + k * 120_000);
    }
    expect(evictions.length).toBeGreaterThan(0);
    expect(l.size).toBeLessThanOrEqual(10);
    expect(l.attempt('victim', 2000)).toBe(58);
  });

  it('does not block unrelated users during a flood', () => {
    const l = createBackoffLimiter({
      freeAttempts: 1,
      baseDelayMs: 60_000,
      maxDelayMs: 600_000,
      maxKeys: 10,
    });
    for (let i = 0; i < 2000; i += 1) {
      l.attempt(`flood${i}`, 0);
      l.attempt(`flood${i}`, 0);
    }
    const blocked = Array.from({ length: 200 }, (_, i) =>
      l.attempt(`user${i}@example.org`, 1),
    ).filter((w) => w > 0);
    expect(blocked).toEqual([]);
  });

  it('remembers failure counts in the sketch after eviction', () => {
    const l = createBackoffLimiter({
      freeAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
      maxKeys: 10,
    });
    l.attempt('slow', 0);
    l.attempt('slow', 0);
    l.attempt('slow', 0); // three free failures recorded
    for (let i = 0; i < 100; i += 1) l.attempt(`noise${i}`, 1);
    expect(l.attempt('slow', 2)).toBe(0); // fourth attempt: allowed but starts the lockout
    expect(l.attempt('slow', 3)).toBe(1);
  });

  it('caps distinct emails per source address per window', () => {
    const limiter = createDistinctKeyLimiter(2, 60_000);
    expect(limiter.admit('ip', 'a', 0)).toBe(0);
    expect(limiter.admit('ip', 'b', 0)).toBe(0);
    expect(limiter.admit('ip', 'a', 0)).toBe(0);
    expect(limiter.admit('ip', 'c', 0)).toBe(60);
    expect(limiter.admit('other-ip', 'c', 0)).toBe(0);
    expect(limiter.admit('ip', 'c', 60_000)).toBe(0);
  });
});

describe('flooding from one address through the API', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext({
      LIMITER_MAX_KEYS: '20',
      LOGIN_IP_DISTINCT_EMAILS_MAX: '5',
      LOGIN_IP_RATE_LIMIT_MAX: '1000',
      LOGIN_RATE_LIMIT_MAX: '1000',
      LOGIN_EMAIL_FREE_ATTEMPTS: '2',
    });
  });
  afterAll(async () => ctx.close());

  it("neither clears other users' lockouts nor blocks unrelated users", async () => {
    for (let i = 0; i < 3; i += 1) await login(ctx, 'victim@example.org', '192.0.2.1');
    expect((await login(ctx, 'victim@example.org', '192.0.2.2')).statusCode).toBe(429);

    const flood: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      flood.push((await login(ctx, `flood${i}@example.org`, '203.0.113.66')).statusCode);
    }
    expect(flood.filter((c) => c === 401)).toHaveLength(5);
    expect(flood.filter((c) => c === 429)).toHaveLength(195);

    expect((await login(ctx, 'victim@example.org', '192.0.2.3')).statusCode).toBe(429);
    expect((await login(ctx, 'bystander@example.org', '198.51.100.40')).statusCode).toBe(401);
  });
});

describe('lockouts survive store eviction through the API', () => {
  it('keeps the victim locked and lets bystanders in while many sources flood', async () => {
    const ctx = await createTestContext({
      LIMITER_MAX_KEYS: '10',
      LOGIN_IP_RATE_LIMIT_MAX: '1000',
      LOGIN_RATE_LIMIT_MAX: '1000',
      LOGIN_EMAIL_FREE_ATTEMPTS: '1',
      LOGIN_EMAIL_BACKOFF_BASE_MS: '60000',
    });
    await login(ctx, 'victim@example.org', '192.0.2.1');
    await login(ctx, 'victim@example.org', '192.0.2.1');
    expect((await login(ctx, 'victim@example.org', '192.0.2.2')).statusCode).toBe(429);
    for (let i = 0; i < 15; i += 1) {
      for (let k = 0; k < 2; k += 1) await login(ctx, `flood${i}@example.org`, `198.18.0.${i + 1}`);
    }
    expect((await login(ctx, 'victim@example.org', '192.0.2.3')).statusCode).toBe(429);
    expect((await login(ctx, 'bystander@example.org', '192.0.2.4')).statusCode).toBe(401);
    await ctx.close();
  });
});

describe('ipKey', () => {
  it('maps IPv4-mapped IPv6 to IPv4 and IPv6 to its /64', () => {
    expect(ipKey('203.0.113.5')).toBe('203.0.113.5');
    expect(ipKey('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(ipKey('::FFFF:198.51.100.7')).toBe('198.51.100.7');
    expect(ipKey('2001:db8:85a3:0001:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:85a3:1::/64');
    expect(ipKey('2001:db8:85a3:1::42')).toBe('2001:db8:85a3:1::/64');
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipKey('::1')).toBe('0:0:0:0::/64');
    expect(ipKey('fe80::1%en0')).toBe('fe80:0:0:0::/64');
    expect(ipKey(undefined)).toBe('unknown');
    expect(ipKey('not-an-ip')).toBe('unknown');
  });
});
