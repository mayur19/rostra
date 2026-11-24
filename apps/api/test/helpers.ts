import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import pino from 'pino';
import { buildApp } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config/env.js';
import { createPool, type Db } from '../src/db/pool.js';
import { createAuthLimiters } from '../src/security/limiters.js';
import { testDatabaseUrl } from './env.js';

export interface TestContext {
  readonly app: FastifyInstance;
  readonly db: Db;
  readonly config: AppConfig;
  close(): Promise<void>;
}

export async function createTestContext(
  overrides: Record<string, string> = {},
): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    SESSION_SECRET: 'test-secret-test-secret-test-secret-0123',
    LOG_LEVEL: 'silent',
    REGISTER_RATE_LIMIT_MAX: '1000',
    ...overrides,
  });
  const db = createPool(config.DATABASE_URL);
  const app = await buildApp({
    config,
    db,
    logger: pino({ level: 'silent' }),
    limiters: createAuthLimiters(config),
  });
  await app.ready();
  return {
    app,
    db,
    config,
    async close() {
      await app.close();
      await db.end();
    },
  };
}

export async function truncateAll(db: Db): Promise<void> {
  await db.query(
    'TRUNCATE organizations, users, sessions, audit_log, skills, employees RESTART IDENTITY CASCADE',
  );
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Minimal cookie-jar client over fastify.inject that also sends the CSRF header. */
export class Client {
  private cookies = new Map<string, string>();
  csrf = '';

  constructor(private readonly app: FastifyInstance) {}

  async request(method: Method, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await this.app.inject({
      method,
      url,
      payload: body === undefined ? undefined : (body as object),
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        ...headers,
      },
    });
    this.store(response);
    return response;
  }

  private store(response: LightMyRequestResponse): void {
    for (const cookie of response.cookies) {
      if (cookie.value === '' || cookie.maxAge === 0) this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, cookie.value);
    }
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  get = (url: string) => this.request('GET', url);
  post = (url: string, body?: unknown) => this.request('POST', url, body ?? {});
  put = (url: string, body: unknown) => this.request('PUT', url, body);
  patch = (url: string, body: unknown) => this.request('PATCH', url, body);
  delete = (url: string) => this.request('DELETE', url);

  async primeCsrf(): Promise<void> {
    const response = await this.get('/api/v1/auth/csrf');
    this.csrf = response.json().data.csrfToken;
  }
}

let counter = 0;

export async function registeredClient(
  app: FastifyInstance,
  overrides: Partial<{ email: string; organizationName: string; timezone: string }> = {},
): Promise<Client> {
  counter += 1;
  const client = new Client(app);
  await client.primeCsrf();
  const response = await client.post('/api/v1/auth/register', {
    organizationName: overrides.organizationName ?? `Ward ${counter}`,
    name: 'Owner',
    email: overrides.email ?? `owner${counter}-${Date.now()}@example.org`,
    password: 'a-very-long-password',
    timezone: overrides.timezone ?? 'UTC',
  });
  if (response.statusCode !== 201) throw new Error(`register failed: ${response.body}`);
  client.csrf = response.json().data.csrfToken;
  return client;
}

export function data<T = unknown>(response: LightMyRequestResponse): T {
  return response.json().data as T;
}
