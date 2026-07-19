import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';
import { useAuth } from './auth-context';

/**
 * Login screen (DESIGN 5.1): app mark, Google sign-in, privacy bullets.
 */
export function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bgBase }]}>
      <Text style={[theme.typography.display, styles.title, { color: theme.colors.textPrimary }]}>
        ◯ YouTube Buddy
      </Text>
      <Text style={[theme.typography.title3, { color: theme.colors.textSecondary }]}>
        Dein Wissen. Lokal.
      </Text>

      <Pressable
        onPress={onSignIn}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Mit Google anmelden"
        style={({ pressed }) => [
          styles.button,
          {
            minHeight: theme.touchTarget.default,
            borderRadius: theme.radius.md,
            backgroundColor: pressed
              ? theme.colors.accentPrimaryStrong
              : theme.colors.accentPrimary,
            opacity: busy ? 0.7 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.colors.accentOnPrimary} />
        ) : (
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
            Mit Google anmelden
          </Text>
        )}
      </Pressable>

      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
      )}

      <View style={styles.bullets}>
        <Bullet text="Nur Lesezugriff auf YouTube" />
        <Bullet text="Alle Daten bleiben auf diesem Gerät" />
        <Bullet text="KI läuft lokal (Modell-Download später)" />
      </View>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Text style={[theme.typography.body, { color: theme.colors.accentPrimary }]}>•</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: {
    marginBottom: 0,
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 260,
  },
  bullets: {
    marginTop: 32,
    gap: 8,
    alignSelf: 'center',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
});
