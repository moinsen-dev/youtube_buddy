import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HowtoV1Output } from '@/core/ai-engine/prompts/howto.v1';
import { getDb } from '@/core/db';
import { getGuide, updateGuideProgress, type GuideRow } from '@/core/db/repositories';
import * as Speech from '@/core/platform/speech';
import { useTheme } from '@/core/theme';

import { formatTimestamp } from '@/features/analysis/chapter-list';

/**
 * Guide mode (M6, DESIGN 5.12): fullscreen step cards — progress bar,
 * Step-sized text, material chips, buttons ≥ 64 pt (back / TTS / watch in
 * video / next), swipe left/right, progress persisted per step.
 */
export function GuideModeScreen({ guideId }: { guideId: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [guide, setGuide] = useState<GuideRow | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const db = await getDb();
        if (!db) return;
        const row = await getGuide(db, guideId);
        if (!cancelled && row) {
          setGuide(row);
          setStepIndex(row.progressStep);
        }
      })();
      return () => {
        cancelled = true;
        void Speech.stop();
      };
    }, [guideId]),
  );

  const payload: HowtoV1Output | null = useMemo(() => {
    if (!guide) return null;
    try {
      return JSON.parse(guide.payload) as HowtoV1Output;
    } catch {
      return null;
    }
  }, [guide]);

  const total = payload?.steps.length ?? 0;
  const step = payload?.steps[Math.min(stepIndex, Math.max(0, total - 1))] ?? null;

  const goTo = useCallback(
    async (nextIndex: number) => {
      if (!guide || !payload) return;
      const clamped = Math.max(0, Math.min(nextIndex, payload.steps.length - 1));
      setStepIndex(clamped);
      void Speech.stop();
      setSpeaking(false);
      const db = await getDb();
      if (db) {
        await updateGuideProgress(db, guide.id, clamped, Date.now());
      }
    },
    [guide, payload],
  );

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -40) void goTo(stepIndex + 1);
          else if (gesture.dx > 40) void goTo(stepIndex - 1);
        },
      }),
    [goTo, stepIndex],
  );

  const toggleSpeech = useCallback(() => {
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!step) return;
    setSpeaking(true);
    Speech.speak(`Schritt ${step.nr} von ${total}. ${step.text}`, {
      language: 'de-DE',
      rate: Platform.OS === 'ios' ? 0.5 : 1.0,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [speaking, step, total]);

  if (!guide || !payload || !step) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>…</Text>
      </View>
    );
  }

  const progress = (stepIndex + 1) / total;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
      {...swipeResponder.panHandlers}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Guide-Modus beenden"
          style={{ minHeight: 64, justifyContent: 'center', paddingHorizontal: 12 }}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>✕</Text>
        </Pressable>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textSecondary }]}>
          Schritt {stepIndex + 1}/{total}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.bgOverlay }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors.accentPrimary,
              width: `${Math.round(progress * 100)}%`,
            },
          ]}
        />
      </View>

      <View style={styles.stepBody}>
        <Text style={[theme.typography.step, { color: theme.colors.textPrimary }]}>
          {step.text}
        </Text>
        {step.materialRefs.length > 0 && (
          <View style={styles.materialRow}>
            {step.materialRefs.map((name) => (
              <View
                key={name}
                style={[
                  styles.materialChip,
                  { borderColor: theme.colors.lineSubtle, borderRadius: theme.radius.sm },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  🧰 {name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => void goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Schritt"
          style={({ pressed }) => [
            styles.navButton,
            {
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
              opacity: stepIndex === 0 ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
            ‹ Zurück
          </Text>
        </Pressable>
        <Pressable
          onPress={toggleSpeech}
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'Vorlesen stoppen' : 'Schritt vorlesen'}
          style={({ pressed }) => [
            styles.navButton,
            {
              borderColor: speaking ? theme.colors.accentPrimary : theme.colors.lineSubtle,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
            },
          ]}
        >
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
            {speaking ? '⏸ Stopp' : '🔊 TTS'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/video/${guide.videoId}?t=${step.sourceSec}`)}
          accessibilityRole="button"
          accessibilityLabel={`Im Video ansehen ab ${formatTimestamp(step.sourceSec)}`}
          style={({ pressed }) => [
            styles.navButton,
            {
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
            },
          ]}
        >
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.info }]}>
            {formatTimestamp(step.sourceSec)} 🎬
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => (stepIndex + 1 >= total ? router.back() : void goTo(stepIndex + 1))}
        accessibilityRole="button"
        accessibilityLabel={stepIndex + 1 >= total ? 'Guide abschließen' : 'Nächster Schritt'}
        style={({ pressed }) => [
          styles.nextButton,
          {
            borderRadius: theme.radius.md,
            backgroundColor: pressed
              ? theme.colors.accentPrimaryStrong
              : theme.colors.accentPrimary,
          },
        ]}
      >
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
          {stepIndex + 1 >= total ? 'Fertig ✓' : 'Weiter ›'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  stepBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  materialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  materialChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  nextButton: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
