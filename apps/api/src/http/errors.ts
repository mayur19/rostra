/** Application errors carry an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const validationFailed = (details: unknown) =>
  new AppError(422, 'VALIDATION_FAILED', 'Request validation failed', details);
export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);
export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new AppError(429, 'RATE_LIMITED', 'Too many attempts, try again later', { retryAfterSeconds });
export const notImplemented = (ticket: string, summary: string) =>
  new AppError(501, 'NOT_IMPLEMENTED', `${summary} is not implemented yet`, { ticket });
