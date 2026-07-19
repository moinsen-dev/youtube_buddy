import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n/strings';
import { useTheme } from '@/core/theme';
import type { SubscriptionListItem } from '@/core/db/repositories';

import { useSubscriptions } from './use-subscriptions';

/**
 * Library screen (M1, DESIGN 5.3): real subscriptions from the local DB
 * with a manual sync action (cache-first). Verlauf/Playlists tabs arrive in
 * later phases.
 */
export function LibraryScreen() {
  const theme = useTheme();
  const strings = t();
  const insets = useSafeAreaInsets();
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
      </View>

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
        <Text style={[theme.typography.body, styles.empty, { color: theme.colors.textSecondary }]}>
          Lade…
        </Text>
      ) : items.length === 0 ? (
        <Text style={[theme.typography.body, styles.empty, { color: theme.colors.textSecondary }]}>
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
    </View>
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
    marginBottom: 8,
  },
  syncButton: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  empty: {
    marginTop: 32,
    textAlign: 'center',
  },
});
