import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import { getSetting, setSetting } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/auth-context';
import { ModelSection } from '@/features/library/model-section';
import { QuotaMeter } from '@/features/library/quota-meter';

/**
 * "Mehr" screen: account, quota, app info. Grows into settings (DESIGN 5.11)
 * in later phases.
 */
export function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { email, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '—';
  const [geocodingOptIn, setGeocodingOptIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      if (!cancelled && db) {
        setGeocodingOptIn((await getSetting(db, 'geocoding_opt_in')) === 'true');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleGeocoding = useCallback(async (value: boolean) => {
    setGeocodingOptIn(value);
    const db = await getDb();
    if (db) await setSetting(db, 'geocoding_opt_in', value ? 'true' : 'false');
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[theme.typography.title1, { color: theme.colors.textPrimary }]}>Mehr</Text>

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
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>Konto</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {email ?? '—'}
        </Text>
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Abmelden"
          style={({ pressed }) => [
            styles.signOut,
            {
              minHeight: theme.touchTarget.default,
              borderRadius: theme.radius.md,
              borderColor: theme.colors.danger,
              backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
            },
          ]}
        >
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.danger }]}>
            Abmelden
          </Text>
        </Pressable>
      </View>

      <ModelSection />

      <Pressable
        onPress={() => router.push('/hygiene')}
        accessibilityRole="button"
        accessibilityLabel="Abo-Hygiene öffnen"
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: pressed ? theme.colors.bgOverlay : theme.colors.bgElevated,
            borderColor: theme.colors.lineSubtle,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            minHeight: theme.touchTarget.default,
          },
        ]}
      >
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Abo-Hygiene
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          Inaktive Abos erkennen und entabonnieren (Vorschläge nach Sehverhalten)
        </Text>
      </Pressable>

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
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>Netzwerk</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              Online-Geocoding (Opt-in)
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Ortsnamen → Koordinaten via Nominatim/OpenStreetMap. Karten-Tiles (OSM) werden beim
              Ansehen der Route geladen. Alles andere bleibt lokal.
            </Text>
          </View>
          <Switch
            value={geocodingOptIn}
            onValueChange={(value) => void toggleGeocoding(value)}
            trackColor={{ false: theme.colors.lineSubtle, true: theme.colors.accentPrimary }}
            accessibilityLabel="Online-Geocoding aktivieren"
          />
        </View>
      </View>

      <QuotaMeter />

      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
        YouTube Buddy v{version} · Local-only · Daten bleiben auf diesem Gerät
      </Text>
    </ScrollView>
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
  card: {
    borderWidth: 1,
    gap: 8,
  },
  signOut: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
});
