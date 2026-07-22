import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sql } from 'drizzle-orm';

import { getEngine, peekEngine } from '@/core/ai-engine/engine-instance';
import { EMBEDDING_MODEL_SPEC } from '@/core/ai-engine/model-registry';
import { downloadModel, isModelDownloaded } from '@/core/ai-engine/model-manager';
import { getDb } from '@/core/db';
import type { Db } from '@/core/db/repositories';
import { indexMissingEmbeddings, searchHybrid, type ScoredOwner } from '@/core/search';
import { useTheme } from '@/core/theme';
import { formatTimestamp } from '@/features/analysis/chapter-list';

/**
 * Search screen (M8, DESIGN 5.9): semantic hybrid search over chunks,
 * notes, concepts and analyses — fully local (embedding model on-device,
 * JS-kNN + FTS5). Type filter chips, results navigate with timestamp jumps.
 */

type Filter = 'all' | 'transcript_chunk' | 'note' | 'concept' | 'analysis';

interface ResultItem extends ScoredOwner {
  icon: string;
  title: string;
  snippet: string;
  sourceSec: number | null;
  videoId: string | null;
  /** For concepts: their note id (navigation target). */
  noteId?: number | null;
}

const TYPE_META: Record<ScoredOwner['ownerType'], { icon: string; label: string }> = {
  transcript_chunk: { icon: '🎬', label: 'Video' },
  note: { icon: '📖', label: 'Notiz' },
  concept: { icon: '◆', label: 'Konzept' },
  analysis: { icon: '📊', label: 'Analyse' },
};

export function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Keyboard shortcut '/' focuses the search field (web only, DESIGN M10).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [modelState, setModelState] = useState<
    'checking' | 'missing' | 'downloading' | 'downloaded' | 'loaded'
  >('checking');
  const [downloadPct, setDownloadPct] = useState(0);
  const [indexState, setIndexState] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkPrereqs = useCallback(async () => {
    // Web: transformers.js caches internally — there is no FileSystem
    // download step like on native (phase 11).
    if (Platform.OS === 'web') {
      setModelState(
        peekEngine()?.loadedEmbeddingModelId === EMBEDDING_MODEL_SPEC.id ? 'loaded' : 'missing',
      );
      return;
    }
    setModelState(
      peekEngine()?.loadedEmbeddingModelId === EMBEDDING_MODEL_SPEC.id
        ? 'loaded'
        : (await isModelDownloaded(EMBEDDING_MODEL_SPEC))
          ? 'downloaded'
          : 'missing',
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void checkPrereqs();
    }, [checkPrereqs]),
  );

  const prepareModel = useCallback(async () => {
    setError(null);
    try {
      // Web: transformers.js downloads + caches the ONNX model itself
      // (phase 11) — no expo-file-system involved.
      if (Platform.OS === 'web') {
        setModelState('downloading');
        const engine = await getEngine();
        if (!engine.loadEmbeddingModel) {
          throw new Error('Diese Engine unterstützt keine Embedding-Modelle');
        }
        await engine.loadEmbeddingModel(EMBEDDING_MODEL_SPEC);
        setModelState('loaded');
        return;
      }
      if ((await isModelDownloaded(EMBEDDING_MODEL_SPEC)) == null) {
        setModelState('downloading');
        const result = await downloadModel(EMBEDDING_MODEL_SPEC, (pct) => setDownloadPct(pct));
        if (result.status !== 'ok') {
          setError(`Download fehlgeschlagen: ${result.status}`);
          setModelState('missing');
          return;
        }
      }
      setModelState('downloaded');
      const engine = await getEngine();
      if (!engine.loadEmbeddingModel) {
        throw new Error('Diese Engine unterstützt keine Embedding-Modelle');
      }
      await engine.loadEmbeddingModel(EMBEDDING_MODEL_SPEC);
      setModelState('loaded');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setModelState('downloaded');
    }
  }, []);

  const runIndex = useCallback(async () => {
    const db = await getDb();
    if (!db) return;
    setIndexState({ running: true, done: 0, total: 0 });
    setError(null);
    try {
      const engine = await getEngine();
      const count = await indexMissingEmbeddings(
        engine,
        db,
        EMBEDDING_MODEL_SPEC.id,
        (done, total) => setIndexState({ running: true, done, total }),
      );
      setIndexedCount(count);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIndexState({ running: false, done: 0, total: 0 });
    }
  }, []);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const db = await getDb();
    if (!db) return;
    setSearching(true);
    setError(null);
    try {
      const started = Date.now();
      const engine = await getEngine();
      const hits = await searchHybrid(engine, db, EMBEDDING_MODEL_SPEC.id, trimmed, 20);
      const items: ResultItem[] = [];
      for (const hit of hits) {
        items.push(await hydrate(db, hit));
      }
      console.log(`[search] "${trimmed}" → ${items.length} Treffer in ${Date.now() - started} ms`);
      setResults(items);
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSearching(false);
    }
  }, [query]);

  const visible = results.filter((item) => filter === 'all' || item.ownerType === filter);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[theme.typography.title1, { color: theme.colors.textPrimary }]}>Suche</Text>

      {modelState !== 'loaded' ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            Semantische Suche vorbereiten
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Embedding-Modell ({EMBEDDING_MODEL_SPEC.name}, ~120 MB) — komplett lokal, einmalig.
          </Text>
          <Pressable
            onPress={() => void prepareModel()}
            disabled={modelState === 'downloading'}
            accessibilityRole="button"
            accessibilityLabel="Embedding-Modell laden"
            style={({ pressed }) => [
              styles.cta,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed
                  ? theme.colors.accentPrimaryStrong
                  : theme.colors.accentPrimary,
                opacity: modelState === 'downloading' ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
              {modelState === 'downloading'
                ? `Lädt ${(downloadPct * 100).toFixed(0)} %…`
                : modelState === 'downloaded'
                  ? 'In Engine laden'
                  : 'Modell laden (120 MB)'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch()}
              placeholder="kochvideo pfanne ohne öl"
              placeholderTextColor={theme.colors.textTertiary}
              returnKeyType="search"
              accessibilityLabel="Suchbegriff"
              style={[
                styles.searchInput,
                theme.typography.body,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.lineSubtle,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.bgElevated,
                },
              ]}
            />
            <Pressable
              onPress={() => void runSearch()}
              disabled={searching}
              accessibilityRole="button"
              accessibilityLabel="Suchen"
              style={({ pressed }) => [
                styles.cta,
                {
                  minHeight: theme.touchTarget.default,
                  borderRadius: theme.radius.md,
                  backgroundColor: pressed
                    ? theme.colors.accentPrimaryStrong
                    : theme.colors.accentPrimary,
                  opacity: searching ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
                {searching ? '…' : '⌕'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.filterRow}>
            {(
              [
                ['all', 'Alle'],
                ['transcript_chunk', 'Videos'],
                ['note', 'Notizen'],
                ['concept', 'Konzepte'],
                ['analysis', 'Analysen'],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setFilter(value)}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${label}`}
                style={[
                  styles.filterChip,
                  {
                    borderColor:
                      filter === value ? theme.colors.accentPrimary : theme.colors.lineSubtle,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {indexState.running ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Indiziere… {indexState.done}/{indexState.total}
            </Text>
          ) : (
            <Pressable
              onPress={() => void runIndex()}
              accessibilityRole="button"
              accessibilityLabel="Index aktualisieren"
              style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.accentPrimary }]}>
                ⟳ Index aktualisieren{indexedCount != null ? ` (${indexedCount} neu)` : ''}
              </Text>
            </Pressable>
          )}

          {visible.map((item) => (
            <Pressable
              key={`${item.ownerType}-${item.ownerId}`}
              onPress={() => navigateToResult(router, item)}
              accessibilityRole="button"
              accessibilityLabel={`${TYPE_META[item.ownerType].label}: ${item.title}`}
              style={({ pressed }) => [
                styles.resultCard,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.lineSubtle,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.lg,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {TYPE_META[item.ownerType].icon} {TYPE_META[item.ownerType].label}
                </Text>
                {item.sourceSec != null && (
                  <Text style={[theme.typography.mono, { color: theme.colors.info }]}>
                    {formatTimestamp(item.sourceSec)}
                  </Text>
                )}
              </View>
              <Text
                style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text
                style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
                numberOfLines={3}
              >
                {item.snippet}
              </Text>
            </Pressable>
          ))}

          {searched && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              {visible.length} Treffer · lokal indiziert
            </Text>
          )}
        </>
      )}
      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
      )}
    </ScrollView>
  );
}

async function hydrate(db: Db, hit: ScoredOwner): Promise<ResultItem> {
  const meta = TYPE_META[hit.ownerType];
  if (hit.ownerType === 'transcript_chunk') {
    const rows = await db.all<{ text: string; start_sec: number; video_id: string }>(
      sql`SELECT c.text, c.start_sec, c.video_id FROM transcript_chunks c WHERE c.id = ${hit.ownerId}`,
    );
    const chunk = rows[0];
    const video = chunk
      ? await db.all<{ title: string }>(sql`SELECT title FROM videos WHERE id = ${chunk.video_id}`)
      : [];
    return {
      ...hit,
      icon: meta.icon,
      title: video[0]?.title ?? 'Video',
      snippet: `„…${chunk?.text.slice(0, 160) ?? ''}…“`,
      sourceSec: chunk?.start_sec != null ? Math.round(chunk.start_sec) : null,
      videoId: chunk?.video_id ?? null,
    };
  }
  if (hit.ownerType === 'note') {
    const rows = await db.all<{ title: string; body_md: string; video_id: string | null }>(
      sql`SELECT title, body_md, video_id FROM notes WHERE id = ${hit.ownerId}`,
    );
    return {
      ...hit,
      icon: meta.icon,
      title: rows[0]?.title ?? 'Notiz',
      snippet: rows[0]?.body_md.slice(0, 160) ?? '',
      sourceSec: null,
      videoId: rows[0]?.video_id ?? null,
    };
  }
  if (hit.ownerType === 'concept') {
    const rows = await db.all<{ display_name: string; note_id: number | null }>(
      sql`SELECT display_name, note_id FROM concepts WHERE id = ${hit.ownerId}`,
    );
    return {
      ...hit,
      icon: meta.icon,
      title: `Konzept: ${rows[0]?.display_name ?? ''}`,
      snippet: '',
      sourceSec: null,
      videoId: null,
      noteId: rows[0]?.note_id ?? null,
    };
  }
  const rows = await db.all<{ kind: string; video_id: string; payload: string }>(
    sql`SELECT kind, video_id, payload FROM analyses WHERE id = ${hit.ownerId}`,
  );
  const row = rows[0];
  let videoTitle = 'Video';
  if (row) {
    const videos = await db.all<{ title: string }>(
      sql`SELECT title FROM videos WHERE id = ${row.video_id}`,
    );
    videoTitle = videos[0]?.title ?? videoTitle;
  }
  return {
    ...hit,
    icon: meta.icon,
    title: `${row?.kind === 'summary' ? 'Zusammenfassung' : (row?.kind ?? 'Analyse')}: ${videoTitle}`,
    snippet: analysisSnippet(row?.kind ?? '', row?.payload ?? ''),
    sourceSec: null,
    videoId: row?.video_id ?? null,
  };
}

/** Human-readable snippet for an analysis payload (no raw JSON dump). */
export function analysisSnippet(kind: string, payload: string): string {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (kind === 'summary') return String(parsed.tldr ?? '').slice(0, 160);
    if (kind === 'triage') return String(parsed.reason ?? '').slice(0, 160);
    if (kind === 'chapters') {
      const chapters = (parsed.chapters as { title: string }[] | undefined) ?? [];
      return chapters
        .map((chapter) => chapter.title)
        .join(' · ')
        .slice(0, 160);
    }
    return payload.slice(0, 160);
  } catch {
    return payload.slice(0, 160);
  }
}

function navigateToResult(router: ReturnType<typeof useRouter>, item: ResultItem): void {
  if (item.ownerType === 'transcript_chunk' && item.videoId) {
    router.push(`/video/${item.videoId}?t=${item.sourceSec ?? 0}`);
  } else if (item.ownerType === 'note') {
    router.push(`/notes/${item.ownerId}`);
  } else if (item.ownerType === 'concept' && item.noteId != null) {
    router.push(`/notes/${item.noteId}`);
  } else if (item.videoId) {
    router.push(`/video/${item.videoId}`);
  }
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderWidth: 1,
    gap: 10,
  },
  cta: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resultCard: {
    borderWidth: 1,
    gap: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
