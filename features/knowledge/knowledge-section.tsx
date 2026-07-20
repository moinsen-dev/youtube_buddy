import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getEngine, peekEngine } from '@/core/ai-engine/engine-instance';
import { getDb } from '@/core/db';
import {
  getAnalysis,
  getNoteForVideo,
  insertNote,
  listFlashcardsForVideo,
  listGuides,
  updateNoteBody,
} from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

import { generateKnowledge } from './generate';

/**
 * Knowledge section for the video detail (M6): "Karten & Guide erstellen"
 * from the video's analysis, result links (review / guide), plus the free
 * markdown note (auto-saved, notes type 'free').
 */
export function KnowledgeSection({ videoId, videoTitle }: { videoId: string; videoTitle: string }) {
  const theme = useTheme();
  const router = useRouter();

  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [cardCount, setCardCount] = useState(0);
  const [guideId, setGuideId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteId, setNoteId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    const db = await getDb();
    if (!db) return;
    setHasAnalysis((await getAnalysis(db, videoId, 'summary')) != null);
    setCardCount((await listFlashcardsForVideo(db, videoId)).length);
    const guide = (await listGuides(db)).find((row) => row.videoId === videoId);
    setGuideId(guide?.id ?? null);
    const note = await getNoteForVideo(db, videoId, 'free');
    setNoteId(note?.id ?? null);
    setNoteText(note?.bodyMd ?? '');
  }, [videoId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!cancelled) await reload();
      })();
      return () => {
        cancelled = true;
      };
    }, [reload]),
  );

  const runGeneration = useCallback(async () => {
    const engine = peekEngine();
    if (!engine?.loadedModelId) {
      setError('Kein Modell geladen — erst im Mehr-Tab ein Modell laden.');
      return;
    }
    const db = await getDb();
    if (!db) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await generateKnowledge(
        await getEngine(),
        db,
        videoId,
        videoTitle,
        controller.signal,
      );
      await reload();
      if (result.guideId) setGuideId(result.guideId);
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === 'AbortError';
      setError(aborted ? 'Abgebrochen' : cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [videoId, videoTitle, reload]);

  const saveNote = useCallback(
    async (text: string) => {
      const db = await getDb();
      if (!db) return;
      if (noteId) {
        await updateNoteBody(db, noteId, text, Date.now());
      } else if (text.trim().length > 0) {
        const id = await insertNote(db, {
          videoId,
          conceptId: null,
          type: 'free',
          title: `Notiz: ${videoTitle}`,
          bodyMd: text,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        setNoteId(id);
      }
    },
    [noteId, videoId, videoTitle],
  );

  return (
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
      <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>Wissen</Text>

      {cardCount > 0 || guideId ? (
        <View style={styles.resultBlock}>
          {cardCount > 0 && (
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              🂠 {cardCount} Karten — Review im Wissen-Tab
            </Text>
          )}
          {guideId && (
            <Pressable
              onPress={() => router.push(`/guide/${guideId}`)}
              accessibilityRole="button"
              accessibilityLabel="Guide öffnen"
              style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
            >
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentPrimary }]}>
                ▸ Guide öffnen
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.resultBlock}>
          <Pressable
            onPress={() => void runGeneration()}
            disabled={!hasAnalysis || busy || peekEngine()?.loadedModelId == null}
            accessibilityRole="button"
            accessibilityLabel="Karten und Guide erstellen"
            style={({ pressed }) => [
              styles.cta,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed
                  ? theme.colors.accentPrimaryStrong
                  : theme.colors.accentPrimary,
                opacity: !hasAnalysis || busy || peekEngine()?.loadedModelId == null ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
              {busy ? 'Erstelle…' : 'Karten & Guide erstellen (lokal)'}
            </Text>
          </Pressable>
          {busy && (
            <Pressable
              onPress={() => abortRef.current?.abort()}
              accessibilityRole="button"
              accessibilityLabel="Erstellung abbrechen"
              style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
                Abbrechen
              </Text>
            </Pressable>
          )}
          {!hasAnalysis && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Erst die Analyse ausführen (s. oben).
            </Text>
          )}
          {!hasAnalysis || peekEngine()?.loadedModelId != null ? null : (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Erst ein Modell im Mehr-Tab laden.
            </Text>
          )}
        </View>
      )}
      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
      )}

      <View style={styles.noteBlock}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          FREIE NOTIZ (Markdown)
        </Text>
        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          onBlur={() => void saveNote(noteText)}
          placeholder="Eigene Gedanken zum Video…"
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          accessibilityLabel="Freie Notiz bearbeiten"
          style={[
            styles.noteInput,
            theme.typography.body,
            {
              color: theme.colors.textPrimary,
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.bgBase,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 12,
  },
  resultBlock: {
    gap: 8,
    alignItems: 'flex-start',
  },
  cta: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  noteBlock: {
    gap: 6,
  },
  noteInput: {
    borderWidth: 1,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
