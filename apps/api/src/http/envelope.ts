export interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface Envelope<T> {
  readonly data: T | null;
  readonly error: ErrorBody | null;
  readonly meta?: Record<string, unknown>;
}

export function ok<T>(data: T, meta?: Record<string, unknown>): Envelope<T> {
  return meta ? { data, error: null, meta } : { data, error: null };
}

export function failure(error: ErrorBody): Envelope<never> {
  return { data: null, error };
}
