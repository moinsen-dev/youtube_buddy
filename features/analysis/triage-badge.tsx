import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

/**
 * TriageBadge (M5, DESIGN §4): 28 px score circle — 4–5 success, 3 warning,
 * 1–2 danger; skeleton while the triage is still running.
 */
export function TriageBadge({ score }: { score: number | null }) {
  const theme = useTheme();
  const color =
    score === null
      ? theme.colors.lineSubtle
      : score >= 4
        ? theme.colors.success
        : score === 3
          ? theme.colors.warning
          : theme.colors.danger;
  return (
    <View
      accessibilityLabel={score === null ? 'Bewertung lädt' : `Bewertung ${score} von 5`}
      style={[styles.circle, { borderColor: color, backgroundColor: theme.colors.bgElevated }]}
    >
      {score !== null && <Text style={[theme.typography.bodyStrong, { color }]}>{score}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
