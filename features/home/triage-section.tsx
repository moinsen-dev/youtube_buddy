import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getEngine, peekEngine } from '@/core/ai-engine/engine-instance';
import type { TriageV1Output } from '@/core/ai-engine/prompts/triage.v1';
import { getDb } from '@/core/db';
import { listTriageForVideos, type VideoListItem } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { TriageBadge } from '@/features/analysis/triage-badge';
import { runTriageBatch } from '@/features/analysis/triage-batch';

/** Videos per batch run (ROADMAP Phase 5 exit: queue of 12). */
const BATCH_LIMIT = 12;

/**
 * Triage section (M5, DESIGN 5.2): Watch-Later queue with score badges and
 * the "Analysiere Queue" batch (on-device, with progress + abort).
 */
export function TriageSection({ videos }: { videos: VideoListItem[] }) {
  const theme = useTheme();
  const router = useRouter();
  const [triages, setTriages] = useState<Map<string, TriageV1Output>>(new Map());
  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });
  const [batchError, setBatchError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadTriages = useCallback(async () => {
    setEngineReady(peekEngine()?.loadedModelId != null);
    const db = await getDb();
    if (!db || videos.length === 0) return;
    const rows = await listTriageForVideos(
      db,
      videos.map((video) => video.id),
    );
    const map = new Map<string, TriageV1Output>();
    for (const row of rows) {
      try {
        map.set(row.videoId, JSON.parse(row.payload) as TriageV1Output);
      } catch {
        // ignore unparsable payloads — a re-run will overwrite them
      }
    }
    setTriages(map);
  }, [videos]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await loadTriages();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTriages]);

  const runBatch = useCallback(async () => {
    const engine = peekEngine();
    if (!engine?.loadedModelId) {
      setBatchError('Kein Modell geladen — erst im Mehr-Tab ein Modell laden.');
      return;
    }
    const db = await getDb();
    if (!db) return;
    const pending = videos.filter((video) => !triages.has(video.id)).slice(0, BATCH_LIMIT);
    if (pending.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBatch({ running: true, done: 0, total: pending.length });
    setBatchError(null);
    try {
      await runTriageBatch(
        await getEngine(),
        db,
        engine.loadedModelId,
        pending,
        (done, total) => setBatch({ running: true, done, total }),
        controller.signal,
      );
      await loadTriages();
      setBatch({ running: false, done: 0, total: 0 });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      await loadTriages();
      setBatch({ running: false, done: 0, total: 0 });
      if (!aborted) {
        setBatchError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      abortRef.current = null;
    }
  }, [videos, triages, loadTriages]);

  const sorted = [...videos].sort(
    (a, b) => (triages.get(b.id)?.score ?? 0) - (triages.get(a.id)?.score ?? 0),
  );
  const pendingCount = videos.filter((video) => !triages.has(video.id)).length;

  return (
    <View style={styles.section}>
      <Text style={[theme.typography.caption, styles.label, { color: theme.colors.textSecondary }]}>
        TRIAGE — WATCH LATER ({videos.length})
      </Text>

      {sorted.map((video) => {
        const triage = triages.get(video.id);
        return (
          <Pressable
            key={video.id}
            onPress={() => router.push(`/video/${video.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${video.title}${triage ? `, Bewertung ${triage.score} von 5` : ''}`}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
              },
            ]}
          >
            <TriageBadge score={triage?.score ?? null} />
            <Text
              style={[theme.typography.body, styles.rowTitle, { color: theme.colors.textPrimary }]}
              numberOfLines={2}
            >
              {video.title}
            </Text>
            <Text style={[theme.typography.mono, { color: theme.colors.textSecondary }]}>
              {formatDuration(video.durationSec)}
            </Text>
          </Pressable>
        );
      })}

      {batch.running ? (
        <View style={styles.batchRow}>
          <View
            style={[
              styles.track,
              { backgroundColor: theme.colors.bgOverlay, borderRadius: theme.radius.sm },
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: theme.colors.accentPrimary,
                  width: `${batch.total > 0 ? Math.round((batch.done / batch.total) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Analysiere Queue… {batch.done}/{batch.total} (lokal)
          </Text>
          <Pressable
            onPress={() => abortRef.current?.abort()}
            accessibilityRole="button"
            accessibilityLabel="Triage-Batch abbrechen"
            style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
              Abbrechen
            </Text>
          </Pressable>
        </View>
      ) : (
        pendingCount > 0 && (
          <Pressable
            onPress={() => void runBatch()}
            accessibilityRole="button"
            accessibilityLabel="Watch-Later-Queue analysieren"
            style={({ pressed }) => [
              styles.batchButton,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                borderColor: theme.colors.lineSubtle,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              Analysiere Queue ▸ (lokal, {Math.min(pendingCount, BATCH_LIMIT)} Videos)
            </Text>
          </Pressable>
        )
      )}
      {!engineReady && pendingCount > 0 && (
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          Erst ein Modell im Mehr-Tab laden.
        </Text>
      )}
      {batchError && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{batchError}</Text>
      )}
    </View>
  );
}

function formatDuration(sec: number | null): string {
  const total = Math.max(0, Math.floor(sec ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  label: {
    marginTop: 16,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  rowTitle: {
    flex: 1,
  },
  batchRow: {
    gap: 6,
  },
  batchButton: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  track: {
    height: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
