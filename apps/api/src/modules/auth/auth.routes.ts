import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ROLE_PERMISSIONS, loginSchema, registerSchema } from '@rostra/shared';
import { requireAuth } from '../../http/auth.js';
import { CSRF_COOKIE, SESSION_COOKIE, type AppDeps } from '../../http/context.js';
import { ok } from '../../http/envelope.js';
import { notFound } from '../../http/errors.js';
import { parse } from '../../http/validate.js';
import { randomToken } from '../../security/tokens.js';
import { recordAudit } from '../audit/audit.service.js';
import { deleteSession, findOrganization } from './auth.repository.js';
import { login, register, type ClientInfo, type IssuedSession } from './auth.service.js';

function clientInfo(request: FastifyRequest): ClientInfo {
  const agent = request.headers['user-agent'];
  return { ip: request.ip ?? null, userAgent: agent ?? null, requestId: String(request.id) };
}

function setSessionCookies(reply: FastifyReply, deps: AppDeps, session: IssuedSession): void {
  const secure = deps.config.COOKIE_SECURE;
  const maxAge = deps.config.SESSION_TTL_HOURS * 3600;
  void reply.setCookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge,
  });
  void reply.setCookie(CSRF_COOKIE, session.csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge,
  });
}

async function profile(deps: AppDeps, request: FastifyRequest) {
  const auth = requireAuth(request);
  const organization = await findOrganization(deps.db, auth.organizationId);
  if (!organization) throw notFound('Organization');
  return {
    user: { id: auth.userId, email: auth.email, name: auth.name, role: auth.role },
    organization,
    permissions: ROLE_PERMISSIONS[auth.role],
    csrfToken: auth.csrfToken,
  };
}

export function authRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/auth/csrf', async (request, reply) => {
    const token = request.auth?.csrfToken ?? randomToken();
    void reply.setCookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: deps.config.COOKIE_SECURE,
      path: '/',
    });
    return ok({ csrfToken: token });
  });

  app.post('/api/v1/auth/register', async (request, reply) => {
    const input = parse(registerSchema, request.body);
    const session = await register(deps, input, clientInfo(request));
    setSessionCookies(reply, deps, session);
    return reply.status(201).send(ok({ csrfToken: session.csrfToken }));
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const session = await login(deps, input, clientInfo(request));
    setSessionCookies(reply, deps, session);
    return ok({ csrfToken: session.csrfToken });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const auth = requireAuth(request);
    await deleteSession(deps.db, auth.sessionId);
    await recordAudit(deps.db, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'auth.logout',
      entityType: 'user',
      entityId: auth.userId,
      requestId: String(request.id),
    });
    void reply.clearCookie(SESSION_COOKIE, { path: '/' }).clearCookie(CSRF_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/api/v1/auth/me', async (request) => ok(await profile(deps, request)));
}
