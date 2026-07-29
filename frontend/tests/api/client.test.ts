import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../../src/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('sends the Telegram init data as a Bearer-style tma Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'auth_date=1&hash=abc' } } });

    const result = await apiFetch<{ hello: string }>('/api/services');

    expect(result).toEqual({ hello: 'world' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/services');
    expect((options.headers as Record<string, string>).Authorization).toBe('tma auth_date=1&hash=abc');
  });

  it('throws ApiError with the response status on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'conflict' }) })
    );
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: '' } } });

    await expect(apiFetch('/api/bookings')).rejects.toMatchObject({ status: 409 } satisfies Partial<ApiError>);
  });
});
