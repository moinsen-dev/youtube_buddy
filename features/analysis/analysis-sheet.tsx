import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

import type { AnalysisProgress } from './analyze';

/**
 * AnalysisSheet (M5, DESIGN 5.5): modal progress while the pipeline runs —
 * bar + step label, On-Device badge with model name, cancel button.
 */
const STEP_LABELS: Record<AnalysisProgress['step'], string> = {
  map: 'Abschnitte werden zusammengefasst',
  reduce: 'Zusammenfassung wird erstellt',
  chapters: 'Kapitel werden erstellt',
  triage: 'Triage läuft',
};

export function AnalysisSheet({
  visible,
  progress,
  modelName,
  onAbort,
}: {
  visible: boolean;
  progress: AnalysisProgress | null;
  modelName: string | null;
  onAbort: () => void;
}) {
  const theme = useTheme();
  const pct = progress ? progress.index / progress.total : 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            Analysiere Video…
          </Text>

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
                  borderRadius: theme.radius.sm,
                  width: `${Math.round(pct * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {progress ? `${STEP_LABELS[progress.step]} (${progress.index}/${progress.total})` : '…'}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              On-Device — keine Daten verlassen das Gerät
              {modelName ? ` · Modell: ${modelName}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={onAbort}
            accessibilityRole="button"
            accessibilityLabel="Analyse abbrechen"
            style={({ pressed }) => [
              styles.abortButton,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.danger,
                backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.danger }]}>
              Abbrechen
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderWidth: 1,
    gap: 12,
    width: '100%',
    maxWidth: 420,
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  abortButton: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
});
