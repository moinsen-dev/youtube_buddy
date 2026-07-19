import { z } from 'zod';

import {
  createMemoryETagCache,
  YouTubeApiError,
  YouTubeClient,
  type YouTubeClientOptions,
} from './client';
import type { QuotaStore } from './quota';

const testSchema = z.object({ etag: z.string(), items: z.array(z.string()).default([]) });

function createQuotaStore(): QuotaStore & { used: Record<string, number> } {
  const used: Record<string, number> = {};
  return {
    used,
    async getUnitsUsed(day: string) {
      return used[day] ?? 0;
    },
    async addUnits(day: string, units: number) {
      used[day] = (used[day] ?? 0) + units;
      return used[day];
    },
  };
}

function fakeResponse(init: { status: number; body?: unknown; etag?: string }): Response {
  const body = init.body ?? {};
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    json: async () => body,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'etag' ? (init.etag ?? null) : null),
    },
  } as unknown as Response;
}

function createClient(overrides: Partial<YouTubeClientOptions> = {}) {
  const quotaStore = createQuotaStore();
  const etagCache = createMemoryETagCache();
  const fetchFn = jest.fn<Promise<Response>, [url: string, init?: RequestInit]>();
  const client = new YouTubeClient({
    getAccessToken: async () => 'token-1',
    quotaStore,
    etagCache,
    fetchFn: fetchFn as unknown as typeof fetch,
    ...overrides,
  });
  return { client, quotaStore, etagCache, fetchFn };
}

describe('core/youtube client', () => {
  it('fetches, validates, records quota and stores the etag', async () => {
    const { client, quotaStore, fetchFn } = createClient();
    fetchFn.mockResolvedValue(
      fakeResponse({ status: 200, body: { etag: 'v1', items: ['a'] }, etag: 'abc' }),
    );

    const result = await client.get('videos.list', { id: 'x', part: 'snippet' }, testSchema);

    expect(result.items).toEqual(['a']);
    const day = new Date().toISOString().slice(0, 10);
    expect(quotaStore.used[day]).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' });
  });

  it('serves 304 from the etag cache without extra quota', async () => {
    const { client, quotaStore, etagCache, fetchFn } = createClient();
    const url = 'https://www.googleapis.com/youtube/v3/videos?id=x&part=snippet';
    await etagCache.set(url, { etag: 'abc', body: { etag: 'v1', items: ['cached'] } });
    fetchFn.mockResolvedValue(fakeResponse({ status: 304 }));
    const before = { ...quotaStore.used };

    const result = await client.get('videos.list', { id: 'x', part: 'snippet' }, testSchema);

    expect(result.items).toEqual(['cached']);
    expect(quotaStore.used).toEqual(before); // no additional quota
    const [, init] = fetchFn.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'If-None-Match': 'abc' });
  });

  it('refreshes the token once on 401', async () => {
    let token = 'stale';
    const onUnauthorized = jest.fn(async () => {
      token = 'fresh';
    });
    const { client, fetchFn } = createClient({
      getAccessToken: async () => token,
      onUnauthorized,
    });
    fetchFn
      .mockResolvedValueOnce(fakeResponse({ status: 401 }))
      .mockResolvedValueOnce(fakeResponse({ status: 200, body: { etag: 'v1', items: [] } }));

    await client.get('videos.list', { id: 'x', part: 'snippet' }, testSchema);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer fresh' });
  });

  it('retries on 429 with backoff', async () => {
    const { client, fetchFn } = createClient();
    fetchFn
      .mockResolvedValueOnce(fakeResponse({ status: 429 }))
      .mockResolvedValueOnce(fakeResponse({ status: 200, body: { etag: 'v1', items: [] } }));

    await client.get('videos.list', { id: 'x', part: 'snippet' }, testSchema);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws YouTubeApiError after retries are exhausted', async () => {
    const { client, fetchFn } = createClient();
    fetchFn.mockResolvedValue(fakeResponse({ status: 500 }));
    await expect(client.get('videos.list', { id: 'x' }, testSchema)).rejects.toBeInstanceOf(
      YouTubeApiError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed payloads via zod', async () => {
    const { client, fetchFn } = createClient();
    fetchFn.mockResolvedValue(fakeResponse({ status: 200, body: { nope: true } }));
    await expect(client.get('videos.list', { id: 'x' }, testSchema)).rejects.toThrow();
  });

  it('throws when no access token is available', async () => {
    const { client } = createClient({ getAccessToken: async () => null });
    await expect(client.get('videos.list', { id: 'x' }, testSchema)).rejects.toBeInstanceOf(
      YouTubeApiError,
    );
  });
});
