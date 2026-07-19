import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

/**
 * VideoCard (DESIGN §4): 16:9 thumbnail with duration badge, bottom progress
 * bar, two-line title. Used on Home rails and (later) lists.
 */
export function VideoCard({
  title,
  thumbnailUrl,
  durationSec,
  percentWatched,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  /** 0–1; renders the 3 px progress bar (accent) when > 0. */
  percentWatched?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.thumb,
          { borderRadius: theme.radius.md, backgroundColor: theme.colors.bgOverlay },
        ]}
      >
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbImage}
            contentFit="cover"
            transition={150}
          />
        ) : null}
        {durationSec !== null && durationSec > 0 && (
          <View
            style={[
              styles.durationBadge,
              { backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: theme.radius.sm },
            ]}
          >
            <Text
              style={[
                theme.typography.mono,
                styles.durationText,
                { color: theme.colors.textPrimary },
              ]}
            >
              {formatDuration(durationSec)}
            </Text>
          </View>
        )}
        {percentWatched !== undefined && percentWatched > 0 && (
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.bgOverlay }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.accentPrimary,
                  width: `${Math.min(100, percentWatched * 100)}%`,
                },
              ]}
            />
          </View>
        )}
      </View>
      <Text
        style={[theme.typography.title3, styles.title, { color: theme.colors.textPrimary }]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    padding: 8,
    gap: 8,
  },
  thumb: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: 11,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
  title: {
    minHeight: 40,
  },
});
