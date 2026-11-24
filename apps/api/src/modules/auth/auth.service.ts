import type { LoginInput, RegisterInput } from '@rostra/shared';
import { withTransaction } from '../../db/pool.js';
import type { AppDeps } from '../../http/context.js';
import { AppError, tooManyRequests } from '../../http/errors.js';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from '../../security/password.js';
import { hashToken, randomToken } from '../../security/tokens.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './auth.repository.js';

export interface ClientInfo {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly requestId: string;
}

export interface IssuedSession {
  readonly token: string;
  readonly csrfToken: string;
  readonly userId: string;
}

async function issueSession(
  deps: AppDeps,
  db: Parameters<typeof repo.insertSession>[0],
  user: { id: string; organizationId: string },
  client: ClientInfo,
): Promise<IssuedSession> {
  const token = randomToken();
  const csrfToken = randomToken();
  await repo.insertSession(db, {
    id: hashToken(token, deps.config.SESSION_SECRET),
    userId: user.id,
    organizationId: user.organizationId,
    csrfToken,
    ip: client.ip,
    userAgent: client.userAgent?.slice(0, 300) ?? null,
    ttlHours: deps.config.SESSION_TTL_HOURS,
  });
  return { token, csrfToken, userId: user.id };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}

/**
 * Deliberately vague so the endpoint does not confirm whether an email is registered.
 * Full uniformity (same response for new and existing emails) needs verified sign-up
 * through the local outbox, tracked as RO-106.
 */
export const REGISTRATION_FAILED_MESSAGE =
  'Registration could not be completed with the details provided';

function throttle(wait: number): void {
  if (wait > 0) throw tooManyRequests(wait);
}

export async function register(
  deps: AppDeps,
  input: RegisterInput,
  client: ClientInfo,
): Promise<IssuedSession> {
  throttle(deps.limiters.register.hit(client.ip ?? 'unknown'));
  const passwordHash = await hashPassword(input.password);
  try {
    return await withTransaction(deps.db, async (tx) => {
      const org = await repo.insertOrganization(tx, input.organizationName, input.timezone);
      const user = await repo.insertUser(tx, {
        organizationId: org.id,
        email: input.email,
        name: input.name,
        passwordHash,
        role: 'owner',
      });
      await recordAudit(tx, {
        organizationId: org.id,
        actorUserId: user.id,
        action: 'organization.registered',
        entityType: 'organization',
        entityId: org.id,
        requestId: client.requestId,
      });
      return issueSession(deps, tx, user, client);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(400, 'REGISTRATION_FAILED', REGISTRATION_FAILED_MESSAGE);
    }
    throw error;
  }
}

export async function login(
  deps: AppDeps,
  input: LoginInput,
  client: ClientInfo,
): Promise<IssuedSession> {
  const ip = client.ip ?? 'unknown';
  const pairKey = `${ip}|${input.email}`;
  const { loginIp, loginPair, loginEmail } = deps.limiters;
  throttle(loginIp.hit(ip));
  throttle(loginPair.hit(pairKey));
  throttle(loginEmail.check(input.email));

  const user = await repo.findUserByEmail(deps.db, input.email);
  // Always run scrypt so response time does not reveal whether the email exists.
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await DUMMY_HASH_PROMISE),
  );
  if (!user || !valid || !user.isActive) {
    loginEmail.fail(input.email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  // The per-IP window is not reset: a sprayer's occasional success must not clear it.
  loginPair.reset(pairKey);
  loginEmail.reset(input.email);
  return withTransaction(deps.db, async (tx) => {
    await repo.touchLogin(tx, user.id);
    await recordAudit(tx, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      requestId: client.requestId,
    });
    return issueSession(deps, tx, user, client);
  });
}
