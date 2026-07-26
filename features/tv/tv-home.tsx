import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text } from 'react-native';

import { getDb } from '@/core/db';
import {
  getSetting,
  listOpenSessions,
  listPlaylistVideos,
  type SessionWithVideo,
  type VideoListItem,
} from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

import { TVVideoCard } from './tv-video-card';
import { tvType } from './tv-type';

/**
 * TV home (phase 12, ROADMAP: "Home-Rails"): Weiterschauen + Watch-Later as
 * horizontal rails of large focusable cards (320×180, DESIGN §3). Selecting a
 * card opens the analysis read view (no player on TV, PRD §7.3).
 */
export function TVHome({ onOpenVideo }: { onOpenVideo: (videoId: string) => void }) {
  const theme = useTheme();
  const [continueWatching, setContinueWatching] = useState<SessionWithVideo[]>([]);
  const [watchLater, setWatchLater] = useState<VideoListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      if (!db) return;
      const sessions = await listOpenSessions(db);
      const playlistId = await getSetting(db, 'watch_later.playlist_id');
      const playlist = playlistId ? await listPlaylistVideos(db, playlistId, 50) : [];
      if (cancelled) return;
      setContinueWatching(sessions);
      setWatchLater(playlist);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      <Text
        style={[
          tvType(theme.typography.caption),
          styles.label,
          { color: theme.colors.textSecondary },
        ]}
      >
        WEITERSCHAUEN
      </Text>
      {continueWatching.length === 0 ? (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textTertiary }]}>
          Nichts am Laufen.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={continueWatching}
          keyExtractor={(item) => String(item.session.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }) => (
            <TVVideoCard
              videoId={item.video.id}
              title={item.video.title}
              thumbnailUrl={item.video.thumbnailUrl}
              durationSec={item.video.durationSec}
              percentWatched={item.session.percentWatched}
              onPress={() => onOpenVideo(item.video.id)}
            />
          )}
        />
      )}

      <Text
        style={[
          tvType(theme.typography.caption),
          styles.label,
          { color: theme.colors.textSecondary },
        ]}
      >
        WATCH LATER ({watchLater.length})
      </Text>
      {watchLater.length === 0 ? (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textTertiary }]}>
          Leer — synchronisiere auf einem anderen Gerät.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={watchLater}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }) => (
            <TVVideoCard
              videoId={item.id}
              title={item.title}
              thumbnailUrl={item.thumbnailUrl}
              durationSec={item.durationSec}
              onPress={() => onOpenVideo(item.id)}
            />
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { gap: 20, paddingBottom: 48 },
  label: { letterSpacing: 1.5, marginTop: 24 },
  rail: { gap: 20, paddingVertical: 12, paddingHorizontal: 4 },
});
