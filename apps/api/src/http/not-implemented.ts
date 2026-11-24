import type { FastifyInstance, HTTPMethods } from 'fastify';
import { notImplemented } from './errors.js';

export interface PendingRoute {
  readonly method: HTTPMethods;
  readonly url: string;
  readonly ticket: string;
  readonly summary: string;
}

/** Registers planned endpoints so the live surface matches docs/api/openapi.yaml. */
export function registerPendingRoutes(app: FastifyInstance, routes: readonly PendingRoute[]): void {
  for (const route of routes) {
    app.route({
      method: route.method,
      url: route.url,
      config: { pending: true },
      handler: async () => {
        throw notImplemented(route.ticket, route.summary);
      },
    });
  }
}
