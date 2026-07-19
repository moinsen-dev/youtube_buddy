import type { z } from 'zod';

import { guardQuota, QuotaBlockedError, type QuotaStore, type YouTubeEndpoint } from './quota';

/**
 * Minimal YouTube Data API client (ARCHITECTURE §6): OAuth token injection,
 * zod validation, quota accounting, ETag cache, retry with backoff.
 * Fetch is injectable for tests.
 */

export interface ETagCacheEntry {
  etag: string;
  body: unknown;
}

export interface ETagCache {
  get(key: string): Promise<ETagCacheEntry | null>;
  set(key: string, entry: ETagCacheEntry): Promise<void>;
}

export function createMemoryETagCache(): ETagCache & { entries: Map<string, ETagCacheEntry> } {
  const entries = new Map<string, ETagCacheEntry>();
  return {
    entries,
    async get(key) {
      return entries.get(key) ?? null;
    },
    async set(key, entry) {
      entries.set(key, entry);
    },
  };
}

export interface YouTubeClientOptions {
  getAccessToken: () => Promise<string | null>;
  quotaStore: QuotaStore;
  etagCache?: ETagCache;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  onQuotaWarn?: (usedToday: number) => void;
  /** Called on a 401 so the auth layer can refresh; client retries once. */
  onUnauthorized?: () => Promise<void>;
}

const DEFAULT_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const MAX_RETRIES = 2;

/** Endpoint names (used for quota) → URL paths of the YouTube Data API v3. */
const ENDPOINT_PATHS: Record<YouTubeEndpoint, string> = {
  'subscriptions.list': 'subscriptions',
  'channels.list': 'channels',
  'playlists.list': 'playlists',
  'playlistItems.list': 'playlistItems',
  'videos.list': 'videos',
};

export class YouTubeApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'YouTubeApiError';
    this.status = status;
  }
}

export class YouTubeClient {
  private readonly options: YouTubeClientOptions;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly etagCache: ETagCache;

  constructor(options: YouTubeClientOptions) {
    this.options = options;
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.etagCache = options.etagCache ?? createMemoryETagCache();
  }

  async get<S extends z.ZodTypeAny>(
    endpoint: YouTubeEndpoint,
    params: Record<string, string>,
    schema: S,
  ): Promise<z.infer<S>> {
    const url = `${this.baseUrl}/${ENDPOINT_PATHS[endpoint]}?${new URLSearchParams(params).toString()}`;
    const cacheKey = url;

    const cached = await this.etagCache.get(cacheKey);
    const headers: Record<string, string> = {};
    if (cached) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await this.requestWithRetry(url, headers);

    if (response.status === 304 && cached) {
      return cached.body as z.infer<S>;
    }
    if (!response.ok) {
      throw new YouTubeApiError(
        response.status,
        `YouTube API ${endpoint} failed with ${response.status}`,
      );
    }

    const json: unknown = await response.json();
    const parsed = schema.parse(json);

    await guardQuota(this.options.quotaStore, endpoint, { onWarn: this.options.onQuotaWarn });

    const etag = response.headers.get('etag');
    if (etag) {
      await this.etagCache.set(cacheKey, { etag, body: parsed });
    }
    return parsed;
  }

  private async requestWithRetry(
    url: string,
    extraHeaders: Record<string, string>,
  ): Promise<Response> {
    let retried401 = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const token = await this.options.getAccessToken();
      if (!token) {
        throw new YouTubeApiError(401, 'No access token available');
      }
      const response = await this.fetchFn(url, {
        headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
      });

      if (response.status === 401 && !retried401 && this.options.onUnauthorized) {
        retried401 = true;
        await this.options.onUnauthorized();
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        await sleep(2 ** attempt * 500);
        continue;
      }
      return response;
    }
    throw new YouTubeApiError(429, 'YouTube API retries exhausted');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { QuotaBlockedError };
