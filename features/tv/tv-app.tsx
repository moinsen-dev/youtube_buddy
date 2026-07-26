import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Focusable } from './focusable';
import { TVAnalysis } from './tv-analysis';
import { TVHome } from './tv-home';
import { TVReisen } from './tv-reisen';
import { TVReview } from './tv-review';
import { tvType } from './tv-type';
import { TVWissen } from './tv-wissen';

type TVScreen = 'home' | 'review' | 'reisen' | 'wissen';

const NAV_ITEMS: { key: TVScreen; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'review', label: 'Karten' },
  { key: 'reisen', label: 'Reisen' },
  { key: 'wissen', label: 'Wissen' },
];

/**
 * TV app shell (phase 12, DESIGN §3): top navigation with focus rings +
 * consumption screens. Self-contained (state navigation, no router pushes) —
 * the TV has no player and no editing flows. Safe area 5 % (DESIGN §3).
 */
export function TVApp() {
  const theme = useTheme();
  const [screen, setScreen] = useState<TVScreen>('home');
  const [analysisVideo, setAnalysisVideo] = useState<{ id: string; title: string | null } | null>(
    null,
  );

  const openVideo = useCallback((videoId: string) => {
    setAnalysisVideo({ id: videoId, title: null });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bgBase }]}>
      <View style={styles.nav}>
        <Text style={[tvType(theme.typography.title3), { color: theme.colors.accentPrimary }]}>
          YouTube Buddy TV
        </Text>
        {NAV_ITEMS.map((item) => (
          <Focusable
            key={item.key}
            onPress={() => {
              setAnalysisVideo(null);
              setScreen(item.key);
            }}
            accessibilityLabel={`Bereich ${item.label}`}
            style={[styles.navItem, { borderRadius: theme.radius.md }]}
          >
            <Text
              style={[
                tvType(theme.typography.bodyStrong),
                {
                  color:
                    screen === item.key && !analysisVideo
                      ? theme.colors.accentPrimary
                      : theme.colors.textSecondary,
                },
              ]}
            >
              {item.label}
            </Text>
          </Focusable>
        ))}
      </View>

      <View style={styles.content}>
        {analysisVideo ? (
          <>
            <Focusable
              onPress={() => setAnalysisVideo(null)}
              accessibilityLabel="Zurück zur Übersicht"
              style={styles.backButton}
            >
              <Text style={[tvType(theme.typography.bodyStrong), { color: theme.colors.info }]}>
                ‹ Zurück
              </Text>
            </Focusable>
            <TVAnalysis videoId={analysisVideo.id} title={analysisVideo.title} />
          </>
        ) : screen === 'home' ? (
          <TVHome onOpenVideo={openVideo} />
        ) : screen === 'review' ? (
          <TVReview />
        ) : screen === 'reisen' ? (
          <TVReisen />
        ) : (
          <TVWissen />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 96, // 5 % safe area at 1080p (DESIGN §3)
    paddingTop: 40,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
    paddingBottom: 32,
  },
  navItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  content: { flex: 1 },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
});
