import Constants from 'expo-constants';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/auth-context';
import { QuotaMeter } from '@/features/library/quota-meter';

/**
 * "Mehr" screen: account, quota, app info. Grows into settings (DESIGN 5.11)
 * in later phases.
 */
export function MoreScreen() {
  const theme = useTheme();
  const { email, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '—';

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
});
