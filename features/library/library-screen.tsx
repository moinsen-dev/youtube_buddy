import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  listHistory,
  type SessionWithVideo,
  type SubscriptionListItem,
} from '@/core/db/repositories';
import { t } from '@/core/i18n/strings';
import { useTheme } from '@/core/theme';

import { useSubscriptions } from './use-subscriptions';

type Segment = 'subs' | 'history';

/**
 * Library screen (M1/M2, DESIGN 5.3): subscriptions with sync action, plus
 * the "Verlauf" tab with the local watch history.
 */
export function LibraryScreen() {
  const theme = useTheme();
  const strings = t();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('subs');
  const { items, watchLaterCount, loading, syncing, lastSync, error, syncNow, isWebOnly } =
    useSubscriptions();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.bgBase, paddingTop: insets.top + 16 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[theme.typography.title1, { color: theme.colors.textPrimary }]}>
          {strings.tabs.library}
        </Text>
        {segment === 'subs' && (
          <Pressable
            onPress={syncNow}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel="Abos synchronisieren"
            style={({ pressed }) => [
              styles.syncButton,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed
                  ? theme.colors.accentPrimaryStrong
                  : theme.colors.accentPrimary,
                opacity: syncing ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
              {syncing ? 'Synchronisiere…' : 'Sync'}
            </Text>
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.segmentRow,
          { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.md },
        ]}
      >
        <SegmentButton
          label="Abos"
          active={segment === 'subs'}
          onPress={() => setSegment('subs')}
        />
        <SegmentButton
          label="Verlauf"
          active={segment === 'history'}
          onPress={() => setSegment('history')}
        />
      </View>

      {segment === 'subs' ? (
        <>
          {lastSync !== null && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Zuletzt synchronisiert: {new Date(lastSync).toLocaleString('de-DE')}
              {isWebOnly ? ' · Web: kein lokaler Cache (Phase 1)' : ''}
            </Text>
          )}
          {watchLaterCount !== null && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Watch Later: {watchLaterCount} Videos synchronisiert
            </Text>
          )}
          {error && (
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
          )}

          {loading ? (
            <Text
              style={[theme.typography.body, styles.empty, { color: theme.colors.textSecondary }]}
            >
              Lade…
            </Text>
          ) : items.length === 0 ? (
            <Text
              style={[theme.typography.body, styles.empty, { color: theme.colors.textSecondary }]}
            >
              Noch keine Abos lokal. Tippe auf „Sync“, um deine YouTube-Abos zu laden.
            </Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.channelId}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => <SubscriptionRow item={item} />}
            />
          )}
        </>
      ) : (
        <HistoryList onOpen={(videoId) => router.push(`/video/${videoId}`)} />
      )}
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.segmentButton,
        {
          borderRadius: theme.radius.sm,
          backgroundColor: active ? theme.colors.bgOverlay : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          theme.typography.bodyStrong,
          { color: active ? theme.colors.accentPrimary : theme.colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SubscriptionRow({ item }: { item: SubscriptionListItem }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: theme.touchTarget.default,
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.lineSubtle,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
      <View style={styles.rowText}>
        <Text
          style={[theme.typography.title3, { color: theme.colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          Abonniert seit {new Date(item.subscribedAt).toLocaleDateString('de-DE')}
        </Text>
      </View>
    </View>
  );
}

function HistoryList({ onOpen }: { onOpen: (videoId: string) => void }) {
  const theme = useTheme();
  const [rows, setRows] = useState<SessionWithVideo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const history = db ? await listHistory(db) : [];
      if (!cancelled) {
        setRows(history);
        setLoaded(true);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <Text style={[theme.typography.body, styles.empty, { color: theme.colors.textSecondary }]}>
        Lade…
      </Text>
    );
  }
  if (rows.length === 0) {
    return (
      <Text style={[theme.typography.body, styles.empty, { color: theme.colors.textSecondary }]}>
        Noch kein Verlauf. Schaue ein Video — die App merkt sich den Fortschritt lokal.
      </Text>
    );
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => String(row.session.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpen(item.video.id)}
          accessibilityRole="button"
          accessibilityLabel={item.video.title}
          style={({ pressed }) => [
            styles.row,
            {
              minHeight: theme.touchTarget.default,
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.rowText}>
            <Text
              style={[theme.typography.title3, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.video.title}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {Math.round(item.session.percentWatched * 100)} % geschaut ·{' '}
              {new Date(item.session.startedAt).toLocaleDateString('de-DE')}
              {item.session.source === 'manual' ? ' · manuell' : ''}
            </Text>
          </View>
          <View
            style={[
              styles.percentBadge,
              {
                backgroundColor:
                  item.session.percentWatched >= 0.8
                    ? theme.colors.success
                    : theme.colors.bgOverlay,
                borderRadius: theme.radius.sm,
              },
            ]}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
              {Math.round(item.session.percentWatched * 100)} %
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  syncButton: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  segmentButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  list: {
    gap: 8,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
  },
});
