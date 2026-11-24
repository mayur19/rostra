import type { FastifyInstance } from 'fastify';
import { employeeCreateSchema, employeeUpdateSchema } from '@rostra/shared';
import { withTransaction } from '../../db/pool.js';
import { requirePermission } from '../../http/auth.js';
import type { AppDeps } from '../../http/context.js';
import { ok } from '../../http/envelope.js';
import { notFound } from '../../http/errors.js';
import { idParams, pageQuery } from '../../http/params.js';
import { parse } from '../../http/validate.js';
import { recordAudit } from '../audit/audit.service.js';
import {
  findEmployee,
  insertEmployee,
  listEmployees,
  updateEmployee,
  type EmployeeDto,
} from './employees.repository.js';

function toInput(employee: EmployeeDto) {
  return {
    name: employee.name,
    email: employee.email,
    hourlyRateMinor: employee.hourlyRateMinor,
    contract: employee.contract,
    skills: employee.skills,
    unavailability: employee.unavailability,
    preferences: employee.preferences,
  };
}

export function employeeRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/employees', async (request) => {
    const auth = requirePermission(request, 'employees:read');
    const page = parse(pageQuery, request.query);
    const { items, total } = await listEmployees(deps.db, auth.organizationId, page);
    return ok(items, { total, ...page });
  });

  app.get('/api/v1/employees/:id', async (request) => {
    const auth = requirePermission(request, 'employees:read');
    const { id } = parse(idParams, request.params);
    const employee = await findEmployee(deps.db, auth.organizationId, id);
    if (!employee) throw notFound('Employee');
    return ok(employee);
  });

  app.post('/api/v1/employees', async (request, reply) => {
    const auth = requirePermission(request, 'employees:write');
    const input = parse(employeeCreateSchema, request.body);
    const employee = await withTransaction(deps.db, async (tx) => {
      const id = await insertEmployee(tx, auth.organizationId, input);
      await recordAudit(tx, {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: 'employee.created',
        entityType: 'employee',
        entityId: id,
        requestId: String(request.id),
      });
      return findEmployee(tx, auth.organizationId, id);
    });
    return reply.status(201).send(ok(employee));
  });

  app.patch('/api/v1/employees/:id', async (request) => {
    const auth = requirePermission(request, 'employees:write');
    const { id } = parse(idParams, request.params);
    const patch = parse(employeeUpdateSchema, request.body);
    const employee = await withTransaction(deps.db, async (tx) => {
      const current = await findEmployee(tx, auth.organizationId, id);
      if (!current) throw notFound('Employee');
      const merged = parse(employeeCreateSchema, { ...toInput(current), ...patch });
      await updateEmployee(tx, auth.organizationId, id, merged);
      await recordAudit(tx, {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: 'employee.updated',
        entityType: 'employee',
        entityId: id,
        requestId: String(request.id),
        details: { fields: Object.keys(patch) },
      });
      return findEmployee(tx, auth.organizationId, id);
    });
    return ok(employee);
  });
}
