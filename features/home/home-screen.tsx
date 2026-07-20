import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  getSetting,
  listOpenSessions,
  listPlaylistVideos,
  type SessionWithVideo,
  type VideoListItem,
} from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { TriageSection } from './triage-section';
import { VideoCard } from './video-card';

/**
 * Home screen (M2 + M5, DESIGN 5.2): "Weiterschauen" rail from open watch
 * sessions, Watch-Later rail and the triage section with the analysis batch.
 */
export function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [continueWatching, setContinueWatching] = useState<SessionWithVideo[]>([]);
  const [watchLater, setWatchLater] = useState<VideoListItem[]>([]);

  const reload = useCallback(async () => {
    const db = await getDb();
    if (!db) return;
    setContinueWatching(await listOpenSessions(db));
    const playlistId = await getSetting(db, 'watch_later.playlist_id');
    if (playlistId) {
      setWatchLater(await listPlaylistVideos(db, playlistId, 50));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[theme.typography.title1, { color: theme.colors.textPrimary }]}>Home</Text>

      <Text
        style={[
          theme.typography.caption,
          styles.sectionLabel,
          { color: theme.colors.textSecondary },
        ]}
      >
        WEITERSCHAUEN
      </Text>
      {continueWatching.length === 0 ? (
        <Text style={[theme.typography.body, { color: theme.colors.textTertiary }]}>
          Nichts am Laufen — starte ein Video aus „Watch Later“.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={continueWatching}
          keyExtractor={(item) => String(item.session.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }) => (
            <VideoCard
              title={item.video.title}
              thumbnailUrl={item.video.thumbnailUrl}
              durationSec={item.video.durationSec}
              percentWatched={item.session.percentWatched}
              accessibilityLabel={`Weiterschauen: ${item.video.title}`}
              onPress={() => router.push(`/video/${item.video.id}`)}
            />
          )}
        />
      )}

      <Text
        style={[
          theme.typography.caption,
          styles.sectionLabel,
          { color: theme.colors.textSecondary },
        ]}
      >
        WATCH LATER ({watchLater.length})
      </Text>
      {watchLater.length === 0 ? (
        <Text style={[theme.typography.body, { color: theme.colors.textTertiary }]}>
          Leer — synchronisiere deine Abos in der Bibliothek.
        </Text>
      ) : (
        <>
          <FlatList
            horizontal
            data={watchLater}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) => (
              <VideoCard
                title={item.title}
                thumbnailUrl={item.thumbnailUrl}
                durationSec={item.durationSec}
                accessibilityLabel={`Abspielen: ${item.title}`}
                onPress={() => router.push(`/video/${item.id}`)}
              />
            )}
          />
          <TriageSection videos={watchLater} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  sectionLabel: {
    marginTop: 16,
    letterSpacing: 1,
  },
  rail: {
    gap: 8,
    paddingVertical: 4,
  },
});
