import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, readCookie } from '../src/api/client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'rostra_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('reads cookies by name', () => {
    expect(readCookie('b', 'a=1; b=two%20words')).toBe('two words');
    expect(readCookie('c', 'a=1')).toBeNull();
  });

  it('unwraps the data envelope and metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, { data: [1], error: null, meta: { total: 1, limit: 50, offset: 0 } }),
      ),
    );
    await expect(apiRequest('GET', '/api/v1/x')).resolves.toEqual({
      data: [1],
      meta: { total: 1, limit: 50, offset: 0 },
    });
  });

  it('sends the CSRF cookie value on mutating requests', async () => {
    document.cookie = 'rostra_csrf=tok123';
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: {}, error: null }));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('POST', '/api/v1/rosters', { name: 'x' });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBe('tok123');
  });

  it('fetches a CSRF token when no cookie exists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { csrfToken: 'fresh' }, error: null }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('POST', '/api/v1/auth/logout', {})).resolves.toEqual({
      data: undefined,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/csrf');
  });

  it('throws ApiError with the server code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(409, {
          data: null,
          error: { code: 'CONFLICT', message: 'Roster is published' },
        }),
      ),
    );
    await expect(apiRequest('GET', '/api/v1/x')).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Roster is published',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 502 })),
    );
    const error = await apiRequest('GET', '/api/v1/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HTTP_ERROR');
  });
});
