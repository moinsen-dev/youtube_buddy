import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';
import type { ChaptersV1Output } from '@/core/ai-engine/prompts/chapters.v1';

/**
 * ChapterList (M5, DESIGN §4): mono timestamp chip + chapter title per row;
 * tap seeks the player. `activeSec` highlights the current chapter.
 */
export function ChapterList({
  chapters,
  activeSec,
  onSeek,
}: {
  chapters: ChaptersV1Output['chapters'];
  activeSec?: number;
  onSeek: (startSec: number) => void;
}) {
  const theme = useTheme();
  // Active chapter = last chapter whose start lies at/before the position.
  const activeStartSec =
    activeSec === undefined
      ? null
      : chapters.reduce<number | null>(
          (best, chapter) =>
            chapter.startSec <= activeSec && (best === null || chapter.startSec > best)
              ? chapter.startSec
              : best,
          null,
        );
  return (
    <View style={styles.list}>
      {chapters.map((chapter) => {
        const active = activeStartSec !== null && chapter.startSec === activeStartSec;
        return (
          <Pressable
            key={`${chapter.startSec}-${chapter.title}`}
            onPress={() => onSeek(chapter.startSec)}
            accessibilityRole="button"
            accessibilityLabel={`Kapitel ${chapter.title}, springe zu ${formatTimestamp(chapter.startSec)}`}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.sm,
                backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                theme.typography.mono,
                styles.chip,
                {
                  color: theme.colors.info,
                  borderColor: theme.colors.lineSubtle,
                  borderRadius: theme.radius.sm,
                },
              ]}
            >
              {formatTimestamp(chapter.startSec)}
            </Text>
            <Text
              style={[
                active ? theme.typography.bodyStrong : theme.typography.body,
                { color: theme.colors.textPrimary, flex: 1 },
              ]}
              numberOfLines={2}
            >
              {chapter.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function formatTimestamp(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
