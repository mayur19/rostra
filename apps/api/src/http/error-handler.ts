import type { FastifyError, FastifyInstance } from 'fastify';
import { ProblemValidationError } from '@rostra/shared';
import { AppError } from './errors.js';
import { failure } from './envelope.js';

/** Maps every error to the JSON envelope; internal details never reach the client. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode === 429) {
        const retry = (error.details as { retryAfterSeconds?: number } | undefined)
          ?.retryAfterSeconds;
        if (retry) void reply.header('retry-after', String(retry));
      }
      return reply
        .status(error.statusCode)
        .send(failure({ code: error.code, message: error.message, details: error.details }));
    }
    if (error instanceof ProblemValidationError) {
      return reply
        .status(422)
        .send(
          failure({
            code: 'INVALID_PROBLEM',
            message: 'Scheduling problem is invalid',
            details: error.issues,
          }),
        );
    }
    const status =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status >= 400 && status < 500) {
      return reply.status(status).send(failure({ code: 'BAD_REQUEST', message: error.message }));
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .status(500)
      .send(failure({ code: 'INTERNAL', message: 'An unexpected error occurred' }));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(
        failure({ code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` }),
      ),
  );
}
