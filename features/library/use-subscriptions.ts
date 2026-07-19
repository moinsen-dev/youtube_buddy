import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDb } from '@/core/db';
import {
  getSetting,
  listActiveSubscriptions,
  type Db,
  type SubscriptionListItem,
} from '@/core/db/repositories';
import { YouTubeClient, createMemoryETagCache } from '@/core/youtube/client';
import { bestThumbnail, parseIsoDate, subscriptionListSchema } from '@/core/youtube/dto';
import { createMemoryQuotaStore } from '@/core/youtube/memory-stores';
import { createDbQuotaStore } from '@/core/youtube/quota-store';
import { syncSubscriptions, syncWatchLater } from '@/core/youtube/sync';
import { useAuth } from '@/features/auth/auth-context';

/**
 * Data hook for the library screen (M1): reads subscriptions from the local
 * DB and syncs on demand (cache-first via TTL in core/youtube/sync).
 * On web (no local DB in phase 1) it fetches into memory only — no cache,
 * every sync hits the network (web persistence lands in phase 11).
 */
export function useSubscriptions() {
  const { getAccessToken } = useAuth();
  const [db, setDb] = useState<Db | null>(null);
  const [dbResolved, setDbResolved] = useState(false);
  const [items, setItems] = useState<SubscriptionListItem[]>([]);
  const [watchLaterCount, setWatchLaterCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () =>
      new YouTubeClient({
        getAccessToken,
        quotaStore: db ? createDbQuotaStore(db) : createMemoryQuotaStore(),
        etagCache: createMemoryETagCache(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db],
  );

  const reload = useCallback(async (database: Db | null) => {
    if (!database) {
      setItems([]);
      return;
    }
    setItems(await listActiveSubscriptions(database));
    const raw = await getSetting(database, 'last_sync.subscriptions');
    setLastSync(raw ? Number(raw) : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const database = await getDb();
      if (cancelled) return;
      setDb(database);
      setDbResolved(true);
      await reload(database);
      setLoading(false);
    })().catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  /** Fetch-only path for web (no local DB): subscriptions straight into state. */
  const syncWebOnly = useCallback(async () => {
    const response = await client.get(
      'subscriptions.list',
      { part: 'snippet', mine: 'true', maxResults: '50' },
      subscriptionListSchema,
    );
    const now = Date.now();
    setItems(
      response.items.map((item) => ({
        channelId: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
        subscribedAt: parseIsoDate(item.snippet.publishedAt) ?? now,
      })),
    );
    setLastSync(now);
  }, [client]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      if (db) {
        // Manual sync is the TTL bypass (ARCHITECTURE §6: TTL or manual).
        await syncSubscriptions(client, db, { force: true });
        const watchLater = await syncWatchLater(client, db, { force: true });
        setWatchLaterCount(watchLater.items);
        await reload(db);
      } else {
        await syncWebOnly();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSyncing(false);
    }
  }, [client, db, reload, syncWebOnly]);

  return {
    items,
    watchLaterCount,
    loading,
    syncing,
    lastSync,
    error,
    syncNow,
    isWebOnly: dbResolved && !db,
  };
}
