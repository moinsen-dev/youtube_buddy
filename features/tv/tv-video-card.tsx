import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Focusable } from './focusable';
import { tvType } from './tv-type';

/**
 * TV card: 320×180 thumbnail (DESIGN §3), focus ring via Focusable.
 * Uses RN core Image — expo-image does not load remote URLs on tvOS
 * (verified on the Apple TV sim, phase 12), the core Image does (same
 * engine that renders the OSM map tiles in the travel view).
 */
export function TVVideoCard({
  videoId,
  title,
  thumbnailUrl,
  durationSec,
  percentWatched,
  onPress,
}: {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  percentWatched?: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  // Older library rows have no thumbnail_url (never fetched); the canonical
  // YouTube thumbnail is derivable from the video id (whitelisted endpoint).
  const uri = thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <Focusable
      onPress={onPress}
      accessibilityLabel={title}
      style={[
        styles.card,
        { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.lg },
      ]}
    >
      <View
        style={[
          styles.thumb,
          { borderRadius: theme.radius.md, backgroundColor: theme.colors.bgOverlay },
        ]}
      >
        <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
        {durationSec !== null && durationSec > 0 && (
          <View
            style={[
              styles.durationBadge,
              { backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: theme.radius.sm },
            ]}
          >
            <Text
              style={[
                tvType(theme.typography.mono),
                { color: theme.colors.textPrimary, fontSize: 16 },
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
        style={[tvType(theme.typography.title3), styles.title, { color: theme.colors.textPrimary }]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Focusable>
  );
}

function formatDuration(sec: number): string {
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
    width: 360,
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 320,
    height: 180,
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: { width: '100%', height: '100%' },
  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
  progressFill: { height: '100%' },
  title: { minHeight: 60 },
});
