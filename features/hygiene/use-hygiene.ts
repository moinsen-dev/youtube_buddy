import { useCallback, useEffect, useState } from 'react';

import { getDb } from '@/core/db';
import { listChannelWatchStats, type ChannelWatchStats, type Db } from '@/core/db/repositories';
import { YouTubeClient, createMemoryETagCache } from '@/core/youtube/client';
import { createDbQuotaStore } from '@/core/youtube/quota-store';
import { useAuth } from '@/features/auth/auth-context';

import { mostWatched, suggestUnsubscribes, type HygieneSuggestion } from './rules';
import { unsubscribeChannels, type UnsubscribeResult } from './unsubscribe';

/**
 * Data hook for the hygiene screen (M9): loads the watch-behavior report
 * from the local DB and runs the batch unsubscribe through YouTubeClient
 * (quota accounting included). The force-ssl consent happens in the screen.
 */
export function useHygiene() {
  const { getAccessToken } = useAuth();
  const [db, setDb] = useState<Db | null>(null);
  const [dbResolved, setDbResolved] = useState(false);
  const [stats, setStats] = useState<ChannelWatchStats[]>([]);
  const [suggestions, setSuggestions] = useState<HygieneSuggestion[]>([]);
  const [topChannels, setTopChannels] = useState<ChannelWatchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (database: Db | null) => {
    if (!database) {
      setStats([]);
      setSuggestions([]);
      setTopChannels([]);
      return;
    }
    const rows = await listChannelWatchStats(database);
    setStats(rows);
    // Rule evaluation stays out of render (Date.now is impure).
    setSuggestions(suggestUnsubscribes(rows, Date.now()));
    setTopChannels(mostWatched(rows));
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

  const runUnsubscribe = useCallback(
    async (channelIds: string[]): Promise<UnsubscribeResult | null> => {
      if (!db) return null;
      setRunning(true);
      setError(null);
      setProgress({ done: 0, total: channelIds.length });
      try {
        const client = new YouTubeClient({
          getAccessToken,
          quotaStore: createDbQuotaStore(db),
          etagCache: createMemoryETagCache(),
        });
        const result = await unsubscribeChannels(client, db, channelIds, (done, total) =>
          setProgress({ done, total }),
        );
        await reload(db);
        return result;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return null;
      } finally {
        setRunning(false);
        setProgress(null);
      }
    },
    [db, getAccessToken, reload],
  );

  return {
    suggestions,
    topChannels,
    totalSubs: stats.length,
    loading,
    running,
    progress,
    error,
    runUnsubscribe,
    isWebOnly: dbResolved && !db,
  };
}

export type { ChannelWatchStats, HygieneSuggestion };
