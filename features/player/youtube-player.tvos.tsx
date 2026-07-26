import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

/**
 * tvOS stub for the YouTube player (phase 12): react-native-webview is not
 * linked on tvOS and playback is out of scope on TV anyway (PRD §7.3 — TV is
 * a consumption view, IFrame playback stays phone/web). Metro resolves this
 * file instead of youtube-player.tsx when building with EXPO_TV=1. Props are
 * duplicated (not imported) so the base file is never pulled into the bundle.
 */
export type PlayerState = 'playing' | 'paused' | 'ended' | 'buffering';

export interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  seekSeconds?: number;
  onReady?: () => void;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onStateChange?: (state: PlayerState) => void;
}

export function YouTubePlayer(_props: YouTubePlayerProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bgElevated }]}>
      <Text style={[theme.typography.body, { color: theme.colors.textTertiary }]}>
        Wiedergabe ist auf Apple TV nicht verfügbar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
