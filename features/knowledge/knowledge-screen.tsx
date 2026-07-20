import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  countDueFlashcards,
  listActiveHabits,
  listGuides,
  listHabitChecksForDay,
  listRecentNotes,
  listReviewDays,
  setHabitCheck,
  type GuideRow,
  type HabitRow,
  type NoteRow,
} from '@/core/db/repositories';
import type { HowtoV1Output } from '@/core/ai-engine/prompts/howto.v1';
import { useTheme } from '@/core/theme';
import { computeStreak, localDayKey } from '@/features/flashcards/srs';

/**
 * Wissen tab (M6, DESIGN 5.13 — Grundgerüst): review tile with due count +
 * streak, guides with progress, habits with today's checkboxes, recent
 * notes. Concepts + graph land in phase 7 (M11).
 */
export function KnowledgeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [dueCount, setDueCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [guideRows, setGuideRows] = useState<GuideRow[]>([]);
  const [habitRows, setHabitRows] = useState<HabitRow[]>([]);
  const [checkedToday, setCheckedToday] = useState<Set<number>>(new Set());
  const [recentNotes, setRecentNotes] = useState<NoteRow[]>([]);
  const [today, setToday] = useState('');

  const reload = useCallback(async () => {
    const day = localDayKey(Date.now());
    setToday(day);
    const db = await getDb();
    if (!db) return;
    const now = Date.now();
    setDueCount(await countDueFlashcards(db, now));
    setStreak(computeStreak(await listReviewDays(db), now));
    setGuideRows(await listGuides(db));
    const habits = await listActiveHabits(db);
    setHabitRows(habits);
    const checks = await listHabitChecksForDay(db, day);
    setCheckedToday(
      new Set(checks.filter((check) => check.done === 1).map((check) => check.habitId)),
    );
    setRecentNotes(await listRecentNotes(db, 6));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const toggleHabit = useCallback(
    async (habitId: number) => {
      const db = await getDb();
      if (!db) return;
      const next = !checkedToday.has(habitId);
      await setHabitCheck(db, habitId, today, next);
      setCheckedToday((current) => {
        const copy = new Set(current);
        if (next) copy.add(habitId);
        else copy.delete(habitId);
        return copy;
      });
    },
    [checkedToday, today],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[theme.typography.title1, { color: theme.colors.textPrimary }]}>Wissen</Text>

      <Pressable
        onPress={() => router.push('/review')}
        accessibilityRole="button"
        accessibilityLabel={`Review starten, ${dueCount} Karten fällig`}
        style={({ pressed }) => [
          styles.reviewCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.lineSubtle,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          🂠 {dueCount} Karten fällig
        </Text>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentPrimary }]}>
          Review starten ›
        </Text>
        {streak > 0 && (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Streak: {streak} {streak === 1 ? 'Tag' : 'Tage'}
          </Text>
        )}
      </Pressable>

      {guideRows.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[theme.typography.caption, styles.label, { color: theme.colors.textSecondary }]}
          >
            GUIDES
          </Text>
          {guideRows.map((guide) => {
            let total = 0;
            let done = 0;
            try {
              const payload = JSON.parse(guide.payload) as HowtoV1Output;
              total = payload.steps.length;
              done = Math.min(guide.progressStep, total);
            } catch {
              // unparsable payload — show 0/0
            }
            return (
              <Pressable
                key={guide.id}
                onPress={() => router.push(`/guide/${guide.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Guide ${guide.title}, Fortschritt ${done} von ${total}`}
                style={({ pressed }) => [
                  styles.listRow,
                  {
                    minHeight: theme.touchTarget.default,
                    borderRadius: theme.radius.md,
                    backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.body,
                    styles.rowTitle,
                    { color: theme.colors.textPrimary },
                  ]}
                  numberOfLines={2}
                >
                  ▸ {guide.title}
                </Text>
                {total > 0 && (
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {done}/{total} {done >= total ? '✓' : ''}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {habitRows.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[theme.typography.caption, styles.label, { color: theme.colors.textSecondary }]}
          >
            GEWOHNHEITEN — HEUTE
          </Text>
          {habitRows.map((habit) => {
            const done = checkedToday.has(habit.id);
            return (
              <Pressable
                key={habit.id}
                onPress={() => void toggleHabit(habit.id)}
                accessibilityRole="button"
                accessibilityLabel={`Gewohnheit ${habit.title}, ${done ? 'erledigt' : 'offen'}`}
                style={({ pressed }) => [
                  styles.listRow,
                  {
                    minHeight: theme.touchTarget.default,
                    borderRadius: theme.radius.md,
                    backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.body,
                    { color: done ? theme.colors.success : theme.colors.textSecondary },
                  ]}
                >
                  {done ? '☑' : '☐'}
                </Text>
                <View style={styles.rowTitle}>
                  <Text
                    style={[
                      theme.typography.body,
                      { color: theme.colors.textPrimary },
                      done && styles.habitDone,
                    ]}
                  >
                    {habit.title}
                  </Text>
                  {habit.cue && (
                    <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                      {habit.cue}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {recentNotes.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[theme.typography.caption, styles.label, { color: theme.colors.textSecondary }]}
          >
            NOTIZEN (zuletzt)
          </Text>
          {recentNotes.map((note) => (
            <View key={note.id} style={styles.noteRow}>
              <Text
                style={[theme.typography.body, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
              >
                • {note.type === 'free' ? 'Freie Notiz' : note.type}: {note.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {dueCount === 0 &&
        guideRows.length === 0 &&
        habitRows.length === 0 &&
        recentNotes.length === 0 && (
          <Text style={[theme.typography.body, { color: theme.colors.textTertiary }]}>
            Noch leer — analysiere ein Video und erstelle Karten & Guide (Video-Detail).
          </Text>
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  reviewCard: {
    borderWidth: 1,
    gap: 6,
  },
  section: {
    gap: 4,
  },
  label: {
    marginTop: 8,
    letterSpacing: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  rowTitle: {
    flex: 1,
    gap: 2,
  },
  habitDone: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  noteRow: {
    paddingVertical: 2,
  },
});
