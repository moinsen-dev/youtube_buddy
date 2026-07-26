import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/core/db';
import {
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
} from '@/features/flashcards/srs';

import { Focusable } from './focusable';
import { tvType } from './tv-type';

const GRADES = [
  { key: 'again', label: 'Nochmal', grade: GRADE_AGAIN },
  { key: 'hard', label: 'Schwer', grade: GRADE_HARD },
  { key: 'good', label: 'Gut', grade: GRADE_GOOD },
  { key: 'easy', label: 'Leicht', grade: GRADE_EASY },
] as const;

/**
 * TV flashcard review (phase 12 exit criterion: "Flashcard-Review mit Siri
 * Remote vollständig bedienbar"). Select flips the card, grade buttons are
 * focus targets — no touch gestures needed (DESIGN §7).
 */
export function TVReview() {
  const theme = useTheme();
  const [queue, setQueue] = useState<FlashcardRow[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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
  }, []);

  const current = queue[index] ?? null;

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
    <View style={styles.container}>
      <Text style={[tvType(theme.typography.title3), { color: theme.colors.textSecondary }]}>
        Review {Math.min(index + 1, queue.length)} von {queue.length}
        {streak > 0 ? ` · Streak ${streak}` : ''}
      </Text>

      {!loaded && (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textSecondary }]}>
          …
        </Text>
      )}

      {loaded && queue.length === 0 && (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textSecondary }]}>
          Keine Karten fällig — alles gelernt.
        </Text>
      )}

      {done && queue.length > 0 && (
        <Text style={[tvType(theme.typography.title2), { color: theme.colors.textPrimary }]}>
          Fertig — {queue.length} {queue.length === 1 ? 'Karte' : 'Karten'} wiederholt.
        </Text>
      )}

      {current && !done && (
        <>
          <Focusable
            onPress={() => setFlipped((value) => !value)}
            accessibilityLabel={flipped ? 'Karte zur Frage wenden' : 'Karte zur Antwort wenden'}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.bgElevated,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Text
              style={[
                tvType(theme.typography.title2),
                styles.cardText,
                { color: theme.colors.textPrimary },
              ]}
            >
              {flipped ? current.back : current.front}
            </Text>
          </Focusable>
          <Text
            style={[
              tvType(theme.typography.caption),
              styles.hint,
              { color: theme.colors.textTertiary },
            ]}
          >
            Select zum Wenden
          </Text>
          <View style={styles.gradeRow}>
            {GRADES.map((option) => (
              <Focusable
                key={option.key}
                onPress={() => {
                  if (flipped) void grade(option.grade);
                }}
                accessibilityLabel={`Bewerten: ${option.label}`}
                style={[
                  styles.gradeButton,
                  {
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.bgElevated,
                    opacity: flipped ? 1 : 0.35,
                  },
                ]}
              >
                <Text
                  style={[tvType(theme.typography.bodyStrong), { color: theme.colors.textPrimary }]}
                >
                  {option.label}
                </Text>
              </Focusable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 24 },
  card: {
    minHeight: 340,
    justifyContent: 'center',
    padding: 48,
  },
  cardText: { textAlign: 'center' },
  hint: { textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  gradeButton: {
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
});
