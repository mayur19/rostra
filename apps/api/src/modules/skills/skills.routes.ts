import type { FastifyInstance } from 'fastify';
import { skillCreateSchema } from '@rostra/shared';
import { withTransaction } from '../../db/pool.js';
import { requirePermission } from '../../http/auth.js';
import type { AppDeps } from '../../http/context.js';
import { ok } from '../../http/envelope.js';
import { conflict } from '../../http/errors.js';
import { parse } from '../../http/validate.js';
import { recordAudit } from '../audit/audit.service.js';
import { insertSkill, listSkills } from './skills.repository.js';

export function skillRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/skills', async (request) => {
    const auth = requirePermission(request, 'employees:read');
    return ok(await listSkills(deps.db, auth.organizationId));
  });

  app.post('/api/v1/skills', async (request, reply) => {
    const auth = requirePermission(request, 'skills:write');
    const input = parse(skillCreateSchema, request.body);
    try {
      const skill = await withTransaction(deps.db, async (tx) => {
        const created = await insertSkill(tx, auth.organizationId, input);
        await recordAudit(tx, {
          organizationId: auth.organizationId,
          actorUserId: auth.userId,
          action: 'skill.created',
          entityType: 'skill',
          entityId: created.id,
          requestId: String(request.id),
          details: { code: created.code },
        });
        return created;
      });
      return reply.status(201).send(ok(skill));
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw conflict(`Skill ${input.code} already exists`);
      throw error;
    }
  });
}
