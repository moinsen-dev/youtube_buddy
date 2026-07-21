import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme';
import { YOUTUBE_FORCE_SSL_SCOPE } from '@/features/auth/config';
import { useAuth } from '@/features/auth/auth-context';

import { useHygiene, type HygieneSuggestion } from './use-hygiene';

/**
 * Subscription hygiene screen (M9, DESIGN 5.10): rule-based unsubscribe
 * suggestions with checkbox selection, most-watched list, batch unsubscribe
 * with one-time incremental Google consent (youtube.force-ssl).
 */
export function HygieneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scopes, requestForceSslScope } = useAuth();
  const {
    suggestions,
    topChannels,
    totalSubs,
    loading,
    running,
    progress,
    error,
    runUnsubscribe,
    isWebOnly,
  } = useHygiene();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((channelId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(suggestions.map((suggestion) => suggestion.channelId)));
  }, [suggestions]);

  const execute = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0 || running) return;

    if (!scopes.includes(YOUTUBE_FORCE_SSL_SCOPE)) {
      const granted = await requestForceSslScope();
      if (!granted) return; // user cancelled the consent
    }
    const result = await runUnsubscribe(ids);
    if (!result) return;
    setSelected(new Set());
    if (result.failed.length > 0) {
      Alert.alert(
        'Teilweise abgeschlossen',
        `${result.done} Kanäle entabonniert, ${result.failed.length} fehlgeschlagen:\n` +
          result.failed
            .slice(0, 3)
            .map((failure) => `• ${failure.reason}`)
            .join('\n'),
      );
    } else {
      Alert.alert('Fertig', `${result.done} Kanäle entabonniert.`);
    }
  }, [selected, running, scopes, requestForceSslScope, runUnsubscribe]);

  const confirm = useCallback(() => {
    const needsConsent = !scopes.includes(YOUTUBE_FORCE_SSL_SCOPE);
    Alert.alert(
      `${selected.size} ${selected.size === 1 ? 'Kanal' : 'Kanäle'} entabonnieren?`,
      needsConsent
        ? 'Einmalig ist dafür eine zusätzliche Google-Zustimmung nötig (YouTube-Schreibzugriff). Danach läuft alles wieder lokal.'
        : 'Das Entabonnieren läuft über die YouTube API und kann hier nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Entabonnieren', style: 'destructive', onPress: () => void execute() },
      ],
    );
  }, [selected.size, scopes, execute]);

  if (isWebOnly) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.bgBase, paddingTop: insets.top + 16 },
        ]}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Abo-Hygiene braucht die lokale Datenbank — verfügbar auf iOS/Android (Web folgt in Phase
          11).
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgBase }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            style={{
              minHeight: theme.touchTarget.default,
              justifyContent: 'center',
              paddingRight: 12,
            }}
          >
            <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
              Abo-Hygiene
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {totalSubs} Abos · {suggestions.length} Vorschläge 💤
            </Text>
          </View>
        </View>

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
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            Vorschläge
          </Text>
          {loading && (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Lade Sehverhalten…
            </Text>
          )}
          {!loading && suggestions.length === 0 && (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Keine Vorschläge — dein Sehverhalten passt zu deinen Abos. (Die Regeln brauchen etwas
              Tracking-Historie aus dem Player.)
            </Text>
          )}
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.channelId}
              suggestion={suggestion}
              checked={selected.has(suggestion.channelId)}
              onToggle={() => toggle(suggestion.channelId)}
            />
          ))}
          {suggestions.length > 1 && (
            <Pressable
              onPress={selectAll}
              accessibilityRole="button"
              accessibilityLabel="Alle auswählen"
              style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
            >
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentPrimary }]}>
                Alle auswählen
              </Text>
            </Pressable>
          )}
        </View>

        {topChannels.length > 0 && (
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
            <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
              Am meisten geschaut
            </Text>
            {topChannels.map((channel) => (
              <View key={channel.channelId} style={styles.topRow}>
                <Text
                  style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}
                  numberOfLines={1}
                >
                  ● {channel.title}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {channel.watchedVideos} Videos ·{' '}
                  {Math.round((channel.avgPercentWatched ?? 0) * 100)} %
                </Text>
              </View>
            ))}
          </View>
        )}

        {error && (
          <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.lineSubtle,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          onPress={confirm}
          disabled={selected.size === 0 || running}
          accessibilityRole="button"
          accessibilityLabel={`${selected.size} Kanäle entabonnieren`}
          style={({ pressed }) => [
            styles.cta,
            {
              minHeight: theme.touchTarget.default,
              borderRadius: theme.radius.md,
              backgroundColor:
                selected.size === 0 || running
                  ? theme.colors.lineSubtle
                  : pressed
                    ? theme.colors.accentPrimaryStrong
                    : theme.colors.accentPrimary,
            },
          ]}
        >
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
            {running && progress
              ? `Entabonniere… ${progress.done}/${progress.total}`
              : `${selected.size} ${selected.size === 1 ? 'Kanal' : 'Kanäle'} entabonnieren`}
          </Text>
        </Pressable>
        {!scopes.includes(YOUTUBE_FORCE_SSL_SCOPE) && (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary, textAlign: 'center' },
            ]}
          >
            (einmalig Google-Zustimmung)
          </Text>
        )}
      </View>
    </View>
  );
}

function SuggestionRow({
  suggestion,
  checked,
  onToggle,
}: {
  suggestion: HygieneSuggestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${suggestion.title}, ${suggestion.reason}`}
      style={({ pressed }) => [
        styles.suggestionRow,
        {
          minHeight: theme.touchTarget.default,
          borderRadius: theme.radius.sm,
          backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
        },
      ]}
    >
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {checked ? '☑' : '☐'}
      </Text>
      <Text
        style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}
        numberOfLines={1}
      >
        {suggestion.title}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        {suggestion.reason}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  card: {
    borderWidth: 1,
    gap: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
    gap: 6,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
