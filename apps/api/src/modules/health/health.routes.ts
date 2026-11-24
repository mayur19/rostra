import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../../http/context.js';
import { ok, failure } from '../../http/envelope.js';

export function healthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/health', async () =>
    ok({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }),
  );

  app.get('/api/v1/ready', async (_request, reply) => {
    try {
      const { rows } = await deps.db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM schema_migrations',
      );
      return ok({ status: 'ready', database: 'up', migrations: rows[0]?.count ?? 0 });
    } catch (error) {
      deps.logger.warn({ err: error }, 'readiness check failed');
      return reply
        .status(503)
        .send(failure({ code: 'NOT_READY', message: 'Database is unavailable or not migrated' }));
    }
  });
}
