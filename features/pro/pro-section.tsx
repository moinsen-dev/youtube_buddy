import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getDb } from '@/core/db';
import { getSetting, setSetting } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatRecoveryCode } from '@/core/sync/crypto';

import { CLOUD_OPT_IN_KEY, getProSession } from './pro-engine';
import { fetchWrappedKey, runSync, uploadWrappedKey } from './run-sync';

/**
 * Pro section for the Mehr tab (ADR PRD §7.6): Firebase connection derived
 * from the existing Google sign-in, E2E sync lifecycle (enable / join /
 * run) and the cloud-analysis opt-in. Entitlement gating (RevenueCat) lands
 * with the store setup — for now Pro unlocks with the Firebase session
 * (dev). Free/local-only usage is unaffected when never connected.
 */
export function ProSection() {
  const theme = useTheme();
  const { getAccessToken } = useAuth();
  const [uid, setUid] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [cloudOptIn, setCloudOptIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const session = await getProSession();
    if (!session) return;
    const restored = await session.restore().catch(() => null);
    setUid(restored);
    setSyncReady((await session.getMasterKey()) !== null);
    const db = await getDb();
    if (db) setCloudOptIn((await getSetting(db, CLOUD_OPT_IN_KEY)) === 'true');
  }, []);

  useEffect(() => {
    void (async () => {
      await reload().catch(() => {});
    })();
  }, [reload]);

  const connect = useCallback(async () => {
    setBusy('connect');
    setError(null);
    try {
      const session = await getProSession();
      if (!session) throw new Error('Firebase ist für diese Umgebung nicht konfiguriert');
      let credential: { idToken?: string | null; accessToken?: string | null };
      if (Platform.OS === 'web') {
        credential = { accessToken: await getAccessToken() };
      } else {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        const tokens = await GoogleSignin.getTokens();
        credential = { idToken: tokens.idToken, accessToken: tokens.accessToken };
      }
      const newUid = await session.signInWithGoogleCredential(credential);
      setUid(newUid);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [getAccessToken]);

  const disconnect = useCallback(async () => {
    const session = await getProSession();
    await session?.signOut();
    setUid(null);
    setSyncReady(false);
  }, []);

  const enableSync = useCallback(async () => {
    setBusy('enable');
    setError(null);
    try {
      const session = await getProSession();
      if (!session || !uid) throw new Error('Erst mit Firebase verbinden');
      const recoveryCode = await session.enableSync((wrapped) =>
        uploadWrappedKey(session, wrapped),
      );
      setSyncReady(true);
      Alert.alert(
        'Recovery-Code notieren',
        `${formatRecoveryCode(recoveryCode)}\n\nNur damit kommen weitere Geräte an deine Daten. Ohne Code sind sie unlesbar — er verlässt das Gerät nie unverschlüsselt.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [uid]);

  const joinSync = useCallback(async () => {
    setBusy('join');
    setError(null);
    try {
      const session = await getProSession();
      if (!session || !uid) throw new Error('Erst mit Firebase verbinden');
      await session.joinSync(joinCode, () => fetchWrappedKey(session));
      setSyncReady(true);
      setJoinCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [uid, joinCode]);

  const syncNow = useCallback(async () => {
    setBusy('sync');
    setError(null);
    try {
      const session = await getProSession();
      const db = await getDb();
      if (!session || !db) throw new Error('Sync nur nativ mit lokaler Datenbank');
      const report = await runSync(db, session);
      Alert.alert(
        'Synchronisiert',
        `${report.pushed} hochgeladen · ${report.pull.applied} übernommen` +
          (report.pull.skippedLocalNewer > 0
            ? ` · ${report.pull.skippedLocalNewer} lokal neuer`
            : ''),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, []);

  const toggleCloud = useCallback(async (value: boolean) => {
    setCloudOptIn(value);
    const db = await getDb();
    if (db) await setSetting(db, CLOUD_OPT_IN_KEY, value ? 'true' : 'false');
  }, []);

  if (Platform.OS === 'web') {
    return null; // v1: Pro is native-only (web persistence lands in phase 11)
  }

  return (
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
        Pro (Beta) — Sync & Cloud
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        Opt-in. Free bleibt 100 % lokal — ohne Verbindung verlässt nichts das Gerät.
      </Text>

      {uid ? (
        <>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Firebase verbunden ({uid.slice(0, 8)}…)
          </Text>

          {syncReady ? (
            <Button
              label={busy === 'sync' ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
              onPress={() => void syncNow()}
              disabled={busy !== null}
            />
          ) : (
            <>
              <Button
                label={
                  busy === 'enable' ? 'Aktiviere…' : 'Sync aktivieren (Recovery-Code erzeugen)'
                }
                onPress={() => void enableSync()}
                disabled={busy !== null}
              />
              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="Recovery-Code (XXXX-XXXX-…)"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    {
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.lineSubtle,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                />
                <Button
                  label={busy === 'join' ? 'Prüfe…' : 'Beitreten'}
                  onPress={() => void joinSync()}
                  disabled={busy !== null || joinCode.trim().length < 20}
                />
              </View>
            </>
          )}

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
                Cloud-Analyse (Opt-in)
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Analysen laufen dann über Gemini in der EU-Cloud statt auf dem Gerät — klar markiert
                im Modell-Eintrag jeder Analyse.
              </Text>
            </View>
            <Switch
              value={cloudOptIn}
              onValueChange={(value) => void toggleCloud(value)}
              trackColor={{ false: theme.colors.lineSubtle, true: theme.colors.accentPrimary }}
              accessibilityLabel="Cloud-Analyse aktivieren"
            />
          </View>

          <Pressable
            onPress={() => void disconnect()}
            accessibilityRole="button"
            accessibilityLabel="Firebase-Verbindung trennen"
            style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
              Verbindung trennen
            </Text>
          </Pressable>
        </>
      ) : (
        <Button
          label={busy === 'connect' ? 'Verbinde…' : 'Mit Firebase verbinden'}
          onPress={() => void connect()}
          disabled={busy !== null}
        />
      )}

      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: theme.touchTarget.default,
          borderRadius: theme.radius.md,
          backgroundColor: disabled
            ? theme.colors.lineSubtle
            : pressed
              ? theme.colors.accentPrimaryStrong
              : theme.colors.accentPrimary,
        },
      ]}
    >
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 10,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
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
