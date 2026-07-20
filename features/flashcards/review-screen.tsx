import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  getVideo,
  insertFlashcardReview,
  listDueFlashcards,
  listReviewDays,
  updateFlashcardScheduling,
  type FlashcardRow,
} from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

import {
  computeStreak,
  review as applyReview,
  GRADE_AGAIN,
  GRADE_EASY,
  GRADE_GOOD,
  GRADE_HARD,
} from './srs';

/**
 * Review session (M6, DESIGN 5.6): due queue, tap-to-flip card with video
 * source, four SM-2 grade buttons, streak counter.
 */
const GRADES = [
  { key: 'again', label: '↺ Nochmal', grade: GRADE_AGAIN },
  { key: 'hard', label: '!! Schwer', grade: GRADE_HARD },
  { key: 'good', label: '✓ Gut', grade: GRADE_GOOD },
  { key: 'easy', label: '★ Leicht', grade: GRADE_EASY },
] as const;

export function ReviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [queue, setQueue] = useState<FlashcardRow[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const db = await getDb();
        if (!db) return;
        const now = Date.now();
        const [due, days] = await Promise.all([listDueFlashcards(db, now, 50), listReviewDays(db)]);
        if (cancelled) return;
        setQueue(due);
        setStreak(computeStreak(days, now));
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const current = queue[index] ?? null;

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!current) return;
      const db = await getDb();
      const video = db ? await getVideo(db, current.videoId) : null;
      if (!cancelled) setVideoTitle(video?.title ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const grade = useCallback(
    async (value: number) => {
      if (!current) return;
      const db = await getDb();
      if (!db) return;
      const now = Date.now();
      const next = applyReview(
        { ease: current.ease, intervalDays: current.intervalDays, reps: current.reps },
        value,
        now,
      );
      await updateFlashcardScheduling(db, current.id, next);
      await insertFlashcardReview(db, { cardId: current.id, reviewedAt: now, grade: value });
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [current],
  );

  const done = loaded && index >= queue.length;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Review {Math.min(index + 1, queue.length)} von {queue.length}
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Review beenden"
          style={{ minHeight: theme.touchTarget.default, justifyContent: 'center', padding: 8 }}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.textSecondary }]}>✕</Text>
        </Pressable>
      </View>

      {!loaded && (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>…</Text>
      )}

      {loaded && queue.length === 0 && (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Keine Karten fällig — alles gelernt. Neue Karten entstehen im Video-Detail (Button „Karten
          &amp; Guide erstellen“).
        </Text>
      )}

      {done && queue.length > 0 && (
        <View style={styles.doneBlock}>
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
            Fertig — {queue.length} {queue.length === 1 ? 'Karte' : 'Karten'} wiederholt.
          </Text>
          {streak > 0 && (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Streak: {streak} {streak === 1 ? 'Tag' : 'Tage'}
            </Text>
          )}
        </View>
      )}

      {current && !done && (
        <>
          <Pressable
            onPress={() => setFlipped((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={flipped ? 'Karte umdrehen zur Frage' : 'Karte umdrehen zur Antwort'}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.lineSubtle,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.xl,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.title2,
                styles.cardText,
                { color: theme.colors.textPrimary },
              ]}
            >
              {flipped ? current.back : current.front}
            </Text>
            {flipped && current.sourceSec != null && (
              <Pressable
                onPress={() => router.push(`/video/${current.videoId}?t=${current.sourceSec}`)}
                accessibilityRole="button"
                accessibilityLabel="Quelle im Video ansehen"
                style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.info }]}>
                  aus: {videoTitle ?? 'Video'} · {formatTimestamp(current.sourceSec)}
                </Text>
              </Pressable>
            )}
          </Pressable>
          <Text
            style={[
              theme.typography.caption,
              styles.flipHint,
              { color: theme.colors.textTertiary },
            ]}
          >
            Tippe zum Wenden
          </Text>

          <View style={styles.gradeRow}>
            {GRADES.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => void grade(option.grade)}
                disabled={!flipped}
                accessibilityRole="button"
                accessibilityLabel={`Bewerten: ${option.label}`}
                style={({ pressed }) => [
                  styles.gradeButton,
                  {
                    minHeight: theme.touchTarget.default,
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.lineSubtle,
                    backgroundColor: pressed ? theme.colors.bgOverlay : theme.colors.bgElevated,
                    opacity: flipped ? 1 : 0.4,
                  },
                ]}
              >
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {streak > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Streak: {streak} {streak === 1 ? 'Tag' : 'Tage'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function formatTimestamp(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    minHeight: 220,
    justifyContent: 'center',
    gap: 12,
  },
  cardText: {
    textAlign: 'center',
  },
  flipHint: {
    textAlign: 'center',
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gradeButton: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBlock: {
    gap: 8,
  },
});
