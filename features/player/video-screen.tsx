import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  getLatestSessionForVideo,
  getVideo,
  insertWatchSession,
  markVideoWatched,
  updateWatchSession,
  upsertVideos,
  type VideoListItem,
  type VideoRow,
} from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { YouTubeClient, createMemoryETagCache } from '@/core/youtube/client';
import { bestThumbnail, parseIsoDate, parseIsoDuration, videoListSchema } from '@/core/youtube/dto';
import { createDbQuotaStore } from '@/core/youtube/quota-store';
import { useAuth } from '@/features/auth/auth-context';
import { PlayerTracker } from './player-tracker';
import { YouTubePlayer } from './youtube-player';

/**
 * Video detail (M2, DESIGN 5.4 — basic, AI tabs arrive in phase 5):
 * IFrame player with resume, watch tracking into watch_sessions, manual
 * "als geschaut markieren".
 */
export function VideoScreen({ videoId }: { videoId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();

  const [video, setVideo] = useState<VideoListItem | null>(null);
  const [resumeSec, setResumeSec] = useState(0);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [percent, setPercent] = useState(0);
  const [ready, setReady] = useState(false);

  const trackerRef = useRef<PlayerTracker | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);

  const tracker = useMemo(() => {
    return new PlayerTracker({
      insert: async (row) => {
        try {
          const db = await getDb();
          if (!db) return -1; // web: no local persistence in phase 2 (memory only)
          return await insertWatchSession(db, row);
        } catch (error) {
          console.error('[player-tracking] insert failed', error);
          return -1;
        }
      },
      update: async (id, patch) => {
        try {
          const db = await getDb();
          if (!db || id < 0) return;
          await updateWatchSession(db, id, patch);
        } catch (error) {
          console.error('[player-tracking] update failed', id, error);
        }
      },
    });
  }, []);
  useEffect(() => {
    trackerRef.current = tracker;
  });

  /** Fetches a single video's metadata via videos.list (1 quota unit). */
  async function fetchVideoMetadata(id: string): Promise<VideoRow | null> {
    try {
      const db = await getDb();
      if (!db) return null;
      const client = new YouTubeClient({
        getAccessToken,
        quotaStore: createDbQuotaStore(db),
        etagCache: createMemoryETagCache(),
      });
      const response = await client.get(
        'videos.list',
        { part: 'snippet,contentDetails', id },
        videoListSchema,
      );
      const item = response.items[0];
      if (!item) return null;
      return {
        id: item.id,
        channelId: item.snippet?.channelId ?? '',
        title: item.snippet?.title ?? '',
        durationSec: parseIsoDuration(item.contentDetails?.duration),
        publishedAt: parseIsoDate(item.snippet?.publishedAt),
        thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
        description: item.snippet?.description ?? null,
        updatedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      if (db) {
        const [videoRow, latest] = await Promise.all([
          getVideo(db, videoId),
          getLatestSessionForVideo(db, videoId),
        ]);
        if (cancelled) return;
        if (videoRow) {
          setVideo(videoRow);
        } else {
          // Unknown video (deep link): fetch metadata once and persist it
          // so watch tracking can reference the row (FK on watch_sessions).
          const fetched = await fetchVideoMetadata(videoId);
          if (!cancelled && fetched) {
            await upsertVideos(db, [fetched]);
            setVideo(fetched);
          }
        }
        if (latest && latest.percentWatched < 0.8) {
          setResumeSec(latest.positionSec);
          setPercent(latest.percentWatched);
        }
      }
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const onReady = useCallback(async () => {
    await trackerRef.current?.start(videoId, positionRef.current);
  }, [videoId]);

  const onProgress = useCallback((position: number, duration: number) => {
    positionRef.current = position;
    if (duration > 0) durationRef.current = duration;
    setPositionSec(position);
    setDurationSec(durationRef.current);
    void trackerRef.current?.tick(position, durationRef.current);
    if (durationRef.current > 0) {
      setPercent((current) => Math.max(current, position / durationRef.current));
    }
  }, []);

  const onStateChange = useCallback((state: 'playing' | 'paused' | 'ended' | 'buffering') => {
    if (state === 'paused') {
      void trackerRef.current?.pause(positionRef.current, durationRef.current);
    } else if (state === 'ended') {
      void trackerRef.current?.end(positionRef.current, durationRef.current);
      setPercent(1);
    }
  }, []);

  // Finalize when leaving the screen.
  useEffect(() => {
    return () => {
      void trackerRef.current?.stop(positionRef.current, durationRef.current);
    };
  }, []);

  const onMarkWatched = useCallback(async () => {
    const db = await getDb();
    if (db) {
      await markVideoWatched(db, videoId, Date.now());
    }
    setPercent(1);
  }, [videoId]);

  if (!ready) {
    return <View style={[styles.container, { backgroundColor: theme.colors.bgBase }]} />;
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
    >
      <View style={styles.playerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          style={[styles.backButton, { minHeight: theme.touchTarget.default }]}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>‹</Text>
        </Pressable>
        <YouTubePlayer
          videoId={videoId}
          startSeconds={resumeSec}
          onReady={onReady}
          onProgress={onProgress}
          onStateChange={onStateChange}
        />
      </View>

      <View style={[styles.meta, { padding: theme.spacing.lg }]}>
        <Text
          style={[theme.typography.title2, { color: theme.colors.textPrimary }]}
          numberOfLines={2}
        >
          {video?.title ?? 'Video'}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {formatDuration(durationSec)} · {Math.round(percent * 100)} % geschaut
          {resumeSec > 0 && positionSec === 0
            ? ` · Fortsetzen bei ${formatDuration(resumeSec)}`
            : ''}
        </Text>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.colors.bgOverlay, borderRadius: theme.radius.sm },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.colors.accentPrimary,
                borderRadius: theme.radius.sm,
                width: `${Math.min(100, percent * 100)}%`,
              },
            ]}
          />
        </View>
        {percent < 0.8 && (
          <Pressable
            onPress={onMarkWatched}
            accessibilityRole="button"
            accessibilityLabel="Als geschaut markieren"
            style={({ pressed }) => [
              styles.watchButton,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.lineSubtle,
                backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              ✓ Als geschaut markieren
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    position: 'absolute',
    zIndex: 2,
    left: 8,
    top: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  meta: {
    gap: 12,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  watchButton: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
});
