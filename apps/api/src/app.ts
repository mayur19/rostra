import cookie from '@fastify/cookie';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyHttpOptions,
  type FastifyInstance,
} from 'fastify';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { TrustProxy } from './config/env.js';
import type { AppDeps } from './http/context.js';
import { registerAuthHooks } from './http/auth.js';
import { registerErrorHandler } from './http/error-handler.js';
import { registerPendingRoutes } from './http/not-implemented.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { employeeRoutes } from './modules/employees/employees.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { PENDING_ROUTES } from './modules/pending/pending.routes.js';
import { rosterRoutes } from './modules/rosters/rosters.routes.js';
import { skillRoutes } from './modules/skills/skills.routes.js';

const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** A hop count trusts that many proxies nearest the server (same semantics as proxy-addr). */
export function toFastifyTrustProxy(
  value: TrustProxy,
): boolean | string[] | ((a: string, hop: number) => boolean) {
  if (typeof value === 'number') return (_address, hop) => hop < value;
  return value;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const options: FastifyHttpOptions<Server, FastifyBaseLogger> = {
    loggerInstance: deps.logger as FastifyBaseLogger,
    bodyLimit: 1_048_576,
    trustProxy: toFastifyTrustProxy(deps.config.TRUST_PROXY),
    genReqId: (request) => {
      const incoming = request.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  };
  const app = Fastify(options) as unknown as FastifyInstance;

  await app.register(cookie);
  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
    void reply.header('x-content-type-options', 'nosniff');
    void reply.header('referrer-policy', 'same-origin');
    void reply.header('cache-control', 'no-store');
  });

  registerErrorHandler(app);
  registerAuthHooks(app, deps);

  healthRoutes(app, deps);
  authRoutes(app, deps);
  auditRoutes(app, deps);
  skillRoutes(app, deps);
  employeeRoutes(app, deps);
  rosterRoutes(app, deps);
  registerPendingRoutes(app, PENDING_ROUTES);

  return app;
}
