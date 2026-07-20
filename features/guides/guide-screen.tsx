import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HowtoV1Output } from '@/core/ai-engine/prompts/howto.v1';
import { getDb } from '@/core/db';
import { getGuide, getVideo, type GuideRow } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

import { formatTimestamp } from '@/features/analysis/chapter-list';

/**
 * Guide overview (M6, DESIGN 5.7): material checklist, ordered steps with
 * source timestamps (jump to video), entry point for the guide mode.
 */
export function GuideScreen({ guideId }: { guideId: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [guide, setGuide] = useState<GuideRow | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [checkedMaterials, setCheckedMaterials] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const db = await getDb();
        if (!db) return;
        const row = await getGuide(db, guideId);
        if (cancelled) return;
        setGuide(row);
        if (row) {
          const video = await getVideo(db, row.videoId);
          if (!cancelled) setVideoTitle(video?.title ?? null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [guideId]),
  );

  const payload: HowtoV1Output | null = React.useMemo(() => {
    if (!guide) return null;
    try {
      return JSON.parse(guide.payload) as HowtoV1Output;
    } catch {
      return null;
    }
  }, [guide]);

  if (!guide || !payload) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>…</Text>
      </View>
    );
  }

  const doneSteps = Math.min(guide.progressStep, payload.steps.length);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          style={{
            minHeight: theme.touchTarget.default,
            justifyContent: 'center',
            paddingRight: 12,
          }}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text
            style={[theme.typography.title2, { color: theme.colors.textPrimary }]}
            numberOfLines={2}
          >
            {guide.title}
          </Text>
          <Pressable
            onPress={() => router.push(`/video/${guide.videoId}`)}
            accessibilityRole="button"
            accessibilityLabel="Quellvideo öffnen"
          >
            <Text
              style={[theme.typography.caption, { color: theme.colors.info }]}
              numberOfLines={1}
            >
              aus: {videoTitle ?? 'Video'}
            </Text>
          </Pressable>
        </View>
      </View>

      {payload.materials.length > 0 && (
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
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            MATERIAL/WERKZEUG
          </Text>
          {payload.materials.map((material, index) => {
            const checked = checkedMaterials.has(index);
            return (
              <Pressable
                key={index}
                onPress={() =>
                  setCheckedMaterials((current) => {
                    const copy = new Set(current);
                    if (checked) copy.delete(index);
                    else copy.add(index);
                    return copy;
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Material ${material.name}, ${checked ? 'vorhanden' : 'fehlt'}`}
                style={[styles.materialRow, { minHeight: theme.touchTarget.default }]}
              >
                <Text
                  style={[
                    theme.typography.body,
                    { color: checked ? theme.colors.success : theme.colors.textSecondary },
                  ]}
                >
                  {checked ? '☑' : '☐'}
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                  {material.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.stepsSection}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          SCHRITTE {doneSteps}/{payload.steps.length} {doneSteps >= payload.steps.length ? '✓' : ''}
        </Text>
        {payload.steps.map((step) => {
          const done = step.nr <= doneSteps;
          return (
            <View key={step.nr} style={styles.stepRow}>
              <Text
                style={[
                  theme.typography.bodyStrong,
                  { color: done ? theme.colors.success : theme.colors.textSecondary, width: 24 },
                ]}
              >
                {done ? '✓' : step.nr}
              </Text>
              <Text
                style={[
                  theme.typography.body,
                  styles.stepText,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {step.text}
              </Text>
              <Pressable
                onPress={() => router.push(`/video/${guide.videoId}?t=${step.sourceSec}`)}
                accessibilityRole="button"
                accessibilityLabel={`Im Video ansehen ab ${formatTimestamp(step.sourceSec)}`}
                style={({ pressed }) => [
                  styles.timestampChip,
                  {
                    borderColor: theme.colors.lineSubtle,
                    borderRadius: theme.radius.sm,
                    backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                  },
                ]}
              >
                <Text style={[theme.typography.mono, { color: theme.colors.info }]}>
                  {formatTimestamp(step.sourceSec)}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push(`/guide-mode/${guide.id}`)}
        accessibilityRole="button"
        accessibilityLabel="Guide-Modus starten"
        style={({ pressed }) => [
          styles.startButton,
          {
            minHeight: theme.touchTarget.default,
            borderRadius: theme.radius.md,
            backgroundColor: pressed
              ? theme.colors.accentPrimaryStrong
              : theme.colors.accentPrimary,
          },
        ]}
      >
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
          ▶ Guide-Modus starten
          {doneSteps > 0 && doneSteps < payload.steps.length
            ? ` (ab Schritt ${doneSteps + 1})`
            : ''}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  card: {
    borderWidth: 1,
    gap: 8,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepsSection: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepText: {
    flex: 1,
  },
  timestampChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
