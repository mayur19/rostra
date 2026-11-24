import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasPermission, type Permission, type Role } from '@rostra/shared';
import { hashToken, safeEqual } from '../security/tokens.js';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  type AppDeps,
  type AuthContext,
} from './context.js';
import { AppError, forbidden, unauthorized } from './errors.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string;
  role: Role;
  email: string;
  name: string;
  csrf_token: string;
}

async function loadSession(deps: AppDeps, token: string): Promise<AuthContext | null> {
  const { rows } = await deps.db.query<SessionRow>(
    `SELECT s.id, s.user_id, s.organization_id, s.csrf_token, u.role, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.is_active`,
    [hashToken(token, deps.config.SESSION_SECRET)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: row.role,
    email: row.email,
    name: row.name,
    csrfToken: row.csrf_token,
  };
}

function checkCsrf(request: FastifyRequest): void {
  const header = request.headers[CSRF_HEADER];
  const cookie = request.cookies[CSRF_COOKIE];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token || !cookie || !safeEqual(token, cookie)) {
    throw new AppError(403, 'CSRF_FAILED', 'Missing or invalid CSRF token');
  }
  if (request.auth && !safeEqual(token, request.auth.csrfToken)) {
    throw new AppError(403, 'CSRF_FAILED', 'CSRF token does not match the session');
  }
}

/** Resolves the session cookie and enforces double-submit CSRF on mutating requests. */
export function registerAuthHooks(app: FastifyInstance, deps: AppDeps): void {
  app.decorateRequest('auth', null);
  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    request.auth = token ? await loadSession(deps, token) : null;
    if (MUTATING.has(request.method) && !request.routeOptions.config.pending) {
      checkCsrf(request);
    }
  });
}

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

export function requirePermission(request: FastifyRequest, permission: Permission): AuthContext {
  const auth = requireAuth(request);
  if (!hasPermission(auth.role, permission)) throw forbidden();
  return auth;
}
