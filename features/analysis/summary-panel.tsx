import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';
import type { SummarizeReduceV1Output } from '@/core/ai-engine/prompts/summarize-reduce.v1';

import { formatTimestamp } from './chapter-list';

/**
 * SummaryPanel (M5, DESIGN §4): TL;DR prominent, expandable long-form
 * summary, key points with tappable source-timestamp chips.
 */
export function SummaryPanel({
  summary,
  onSeek,
}: {
  summary: SummarizeReduceV1Output;
  onSeek: (startSec: number) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
        {summary.tldr}
      </Text>

      <Pressable
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Langfassung einklappen' : 'Langfassung ausklappen'}
        style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
      >
        <Text style={[theme.typography.caption, { color: theme.colors.accentPrimary }]}>
          {expanded ? '▾ Weniger' : '▸ Ausführliche Zusammenfassung'}
        </Text>
      </Pressable>
      {expanded && (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {summary.summary}
        </Text>
      )}

      <View style={styles.keyPoints}>
        {summary.keyPoints.map((point, index) => (
          <View key={index} style={styles.keyPoint}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>•</Text>
            <View style={styles.keyPointBody}>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                {point.text}
              </Text>
              <View style={styles.refs}>
                {point.sourceRefs.map((ref) => (
                  <Pressable
                    key={ref.startSec}
                    onPress={() => onSeek(ref.startSec)}
                    accessibilityRole="button"
                    accessibilityLabel={`Quelle, springe zu ${formatTimestamp(ref.startSec)}`}
                    style={({ pressed }) => [
                      styles.refChip,
                      {
                        borderColor: theme.colors.lineSubtle,
                        borderRadius: theme.radius.sm,
                        backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[theme.typography.mono, { color: theme.colors.info }]}>
                      {formatTimestamp(ref.startSec)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  keyPoints: {
    gap: 8,
    marginTop: 4,
  },
  keyPoint: {
    flexDirection: 'row',
    gap: 8,
  },
  keyPointBody: {
    flex: 1,
    gap: 4,
  },
  refs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  refChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
