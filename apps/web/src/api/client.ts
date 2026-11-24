/** Thin fetch wrapper: JSON envelope, cookie session, CSRF double-submit header. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function readCookie(name: string, source: string = document.cookie): string | null {
  const match = source.split('; ').find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function ensureCsrf(): Promise<string> {
  const existing = readCookie('rostra_csrf');
  if (existing) return existing;
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
  const body = (await response.json()) as { data: { csrfToken: string } };
  return body.data.csrfToken;
}

export interface Page {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T; meta?: Page }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (MUTATING.has(method)) headers['x-csrf-token'] = await ensureCsrf();
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return { data: undefined as T };
  const payload = (await response.json().catch(() => null)) as {
    data: T;
    error: { code: string; message: string; details?: unknown } | null;
    meta?: Page;
  } | null;
  if (!response.ok || !payload || payload.error) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }
  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: <T>(path: string) => apiRequest<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => apiRequest<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => apiRequest<T>('PUT', path, body),
};
