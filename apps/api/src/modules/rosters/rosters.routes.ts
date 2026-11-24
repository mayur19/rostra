import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CONSTRAINTS,
  DEFAULT_WEIGHTS,
  evaluateRequestSchema,
  pinRequestSchema,
  rosterCreateSchema,
  shiftCreateSchema,
  solveRequestSchema,
} from '@rostra/shared';
import { withTransaction } from '../../db/pool.js';
import { requirePermission } from '../../http/auth.js';
import type { AppDeps } from '../../http/context.js';
import { ok } from '../../http/envelope.js';
import { idParams } from '../../http/params.js';
import { parse } from '../../http/validate.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './rosters.repository.js';
import * as service from './rosters.service.js';

const shiftParams = z.object({ id: z.string().uuid(), shiftId: z.string().uuid() });

export function rosterRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/constraints', async () =>
    ok({ constraints: CONSTRAINTS, defaultWeights: DEFAULT_WEIGHTS }),
  );

  app.get('/api/v1/rosters', async (request) => {
    const auth = requirePermission(request, 'rosters:read');
    return ok(await repo.listRosters(deps.db, auth.organizationId));
  });

  app.post('/api/v1/rosters', async (request, reply) => {
    const auth = requirePermission(request, 'rosters:write');
    const input = parse(rosterCreateSchema, request.body);
    const roster = await withTransaction(deps.db, async (tx) => {
      const id = await repo.insertRoster(tx, auth.organizationId, auth.userId, input);
      await recordAudit(tx, {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: 'roster.created',
        entityType: 'roster',
        entityId: id,
        requestId: String(request.id),
      });
      return repo.findRoster(tx, auth.organizationId, id);
    });
    return reply.status(201).send(ok(roster));
  });

  app.get('/api/v1/rosters/:id', async (request) => {
    const auth = requirePermission(request, 'rosters:read');
    const { id } = parse(idParams, request.params);
    return ok(await service.requireRoster(deps.db, auth, id));
  });

  app.get('/api/v1/rosters/:id/shifts', async (request) => {
    const auth = requirePermission(request, 'rosters:read');
    const { id } = parse(idParams, request.params);
    const roster = await service.requireRoster(deps.db, auth, id);
    return ok(await repo.listShifts(deps.db, roster.id));
  });

  app.post('/api/v1/rosters/:id/shifts', async (request, reply) => {
    const auth = requirePermission(request, 'rosters:write');
    const { id } = parse(idParams, request.params);
    const input = parse(shiftCreateSchema, request.body);
    const shift = await service.addShift(deps, auth, id, input, String(request.id));
    return reply.status(201).send(ok(shift));
  });

  app.delete('/api/v1/rosters/:id/shifts/:shiftId', async (request, reply) => {
    const auth = requirePermission(request, 'rosters:write');
    const { id, shiftId } = parse(shiftParams, request.params);
    await service.removeShift(deps, auth, id, shiftId, String(request.id));
    return reply.status(204).send();
  });

  app.get('/api/v1/rosters/:id/schedule', async (request) => {
    const auth = requirePermission(request, 'rosters:read');
    const { id } = parse(idParams, request.params);
    return ok(await service.getSchedule(deps.db, auth, id));
  });

  app.post('/api/v1/rosters/:id/solve', async (request) => {
    const auth = requirePermission(request, 'rosters:solve');
    const { id } = parse(idParams, request.params);
    const input = parse(solveRequestSchema, request.body ?? {});
    return ok(await service.solveRoster(deps, auth, id, input, String(request.id)));
  });

  app.post('/api/v1/rosters/:id/evaluate', async (request) => {
    const auth = requirePermission(request, 'rosters:read');
    const { id } = parse(idParams, request.params);
    const { assignments } = parse(evaluateRequestSchema, request.body);
    return ok(await service.evaluateProposal(deps.db, auth, id, assignments));
  });

  app.put('/api/v1/rosters/:id/assignments', async (request) => {
    const auth = requirePermission(request, 'rosters:write');
    const { id } = parse(idParams, request.params);
    const { assignments } = parse(pinRequestSchema, request.body);
    return ok(await service.replaceAssignments(deps, auth, id, assignments, String(request.id)));
  });

  app.get('/api/v1/rosters/:id/solver-runs', async (request) => {
    const auth = requirePermission(request, 'rosters:read');
    const { id } = parse(idParams, request.params);
    const roster = await service.requireRoster(deps.db, auth, id);
    return ok(await repo.listSolverRuns(deps.db, roster.id));
  });
}
