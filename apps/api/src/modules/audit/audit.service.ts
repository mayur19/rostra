import type { Queryable } from '../../db/pool.js';

export interface AuditEntry {
  readonly organizationId: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;
}

/** Appends to the audit trail inside the caller's transaction (never secrets in details). */
export async function recordAudit(db: Queryable, entry: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (organization_id, actor_user_id, action, entity_type, entity_id, request_id, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.organizationId,
      entry.actorUserId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.requestId ?? null,
      JSON.stringify(entry.details ?? {}),
    ],
  );
}
