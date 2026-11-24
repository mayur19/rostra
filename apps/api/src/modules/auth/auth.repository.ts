import type { Role } from '@rostra/shared';
import type { Queryable } from '../../db/pool.js';

export interface UserRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly passwordHash: string;
  readonly isActive: boolean;
}

const USER_COLUMNS = `id, organization_id AS "organizationId", email, name, role,
  password_hash AS "passwordHash", is_active AS "isActive"`;

export async function findUserByEmail(db: Queryable, email: string): Promise<UserRecord | null> {
  const { rows } = await db.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function insertOrganization(db: Queryable, name: string, timezone: string) {
  const { rows } = await db.query<{ id: string; name: string; timezone: string }>(
    'INSERT INTO organizations (name, timezone) VALUES ($1, $2) RETURNING id, name, timezone',
    [name, timezone],
  );
  return rows[0] as { id: string; name: string; timezone: string };
}

export async function insertUser(
  db: Queryable,
  user: { organizationId: string; email: string; name: string; passwordHash: string; role: Role },
): Promise<UserRecord> {
  const { rows } = await db.query<UserRecord>(
    `INSERT INTO users (organization_id, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${USER_COLUMNS}`,
    [user.organizationId, user.email, user.name, user.passwordHash, user.role],
  );
  return rows[0] as UserRecord;
}

export async function insertSession(
  db: Queryable,
  session: {
    id: string;
    userId: string;
    organizationId: string;
    csrfToken: string;
    ip: string | null;
    userAgent: string | null;
    ttlHours: number;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO sessions (id, user_id, organization_id, csrf_token, ip, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(hours => $7))`,
    [
      session.id,
      session.userId,
      session.organizationId,
      session.csrfToken,
      session.ip,
      session.userAgent,
      session.ttlHours,
    ],
  );
}

export async function deleteSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

export async function touchLogin(db: Queryable, userId: string): Promise<void> {
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
}

export async function findOrganization(db: Queryable, id: string) {
  const { rows } = await db.query<{ id: string; name: string; timezone: string }>(
    'SELECT id, name, timezone FROM organizations WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
