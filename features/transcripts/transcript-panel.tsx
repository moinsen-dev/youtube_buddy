import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';
import { formatDuration } from '@/features/home/video-card';

import type { TranscriptStatus } from './use-transcript';
import type { TranscriptChunkRow } from '@/core/db/repositories';

/**
 * Transcript panel for the video detail (M3): states loading / ready /
 * no-captions / error-with-retry, chunks with mono timestamps.
 */
export function TranscriptPanel({
  status,
  chunks,
  lang,
  error,
  onRetry,
}: {
  status: TranscriptStatus;
  chunks: TranscriptChunkRow[];
  lang: string | null;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

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
      <Pressable
        onPress={() => status === 'ready' && setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
      >
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Transkript
        </Text>
        {status === 'ready' && (
          <Text style={[theme.typography.caption, { color: theme.colors.accentPrimary }]}>
            {expanded ? '▾ zuklappen' : '▸ aufklappen'}
          </Text>
        )}
      </Pressable>

      {status === 'loading' && (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Lade Untertitel…
        </Text>
      )}
      {status === 'no-captions' && (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Für dieses Video sind keine Untertitel verfügbar.
        </Text>
      )}
      {status === 'error' && (
        <View style={styles.errorRow}>
          <Text style={[theme.typography.body, { color: theme.colors.danger }]}>
            Fehler: {error}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Erneut versuchen"
            style={({ pressed }) => [
              styles.retryButton,
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
              Retry
            </Text>
          </Pressable>
        </View>
      )}
      {status === 'ready' && (
        <>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {chunks.length} Abschnitte · Sprache: {lang ?? '—'}
          </Text>
          <ScrollView
            style={[styles.chunkList, expanded ? styles.chunkListExpanded : null]}
            nestedScrollEnabled
          >
            {(expanded ? chunks : chunks.slice(0, 2)).map((chunk) => (
              <View key={chunk.idx} style={styles.chunkRow}>
                <Text
                  style={[theme.typography.mono, styles.timestamp, { color: theme.colors.info }]}
                >
                  {formatDuration(chunk.startSec)}
                </Text>
                <Text
                  style={[
                    theme.typography.body,
                    styles.chunkText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {chunk.text}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorRow: {
    gap: 8,
    alignItems: 'flex-start',
  },
  retryButton: {
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  chunkList: {
    maxHeight: 160,
  },
  chunkListExpanded: {
    maxHeight: 400,
  },
  chunkRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  timestamp: {
    width: 48,
    marginTop: 3,
  },
  chunkText: {
    flex: 1,
  },
});
