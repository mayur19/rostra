import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../http/context.js';
import { requirePermission } from '../../http/auth.js';
import { ok } from '../../http/envelope.js';
import { parse } from '../../http/validate.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function auditRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/audit-logs', async (request) => {
    const auth = requirePermission(request, 'audit:read');
    const { limit, offset } = parse(querySchema, request.query);
    const [{ rows }, count] = await Promise.all([
      deps.db.query(
        `SELECT id, actor_user_id AS "actorUserId", action, entity_type AS "entityType",
                entity_id AS "entityId", request_id AS "requestId", details, created_at AS "createdAt"
           FROM audit_log WHERE organization_id = $1
          ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
        [auth.organizationId, limit, offset],
      ),
      deps.db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM audit_log WHERE organization_id = $1',
        [auth.organizationId],
      ),
    ]);
    return ok(rows, { total: count.rows[0]?.total ?? 0, limit, offset });
  });
}
