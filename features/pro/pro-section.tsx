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
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { getDb } from '@/core/db';
import { getSetting, setSetting } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  formatRecoveryCode,
  generateRecoveryCode,
  wrapMasterKey,
  bytesToBase64,
} from '@/core/sync/crypto';

import { CLOUD_OPT_IN_KEY, getProSession } from './pro-engine';
import {
  configurePurchases,
  getCustomerAccess,
  getProPackages,
  purchasePackage,
  restorePurchases,
  type CustomerAccess,
  type ProPackage,
  type RevenueCatKeys,
} from './purchases';
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
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [uid, setUid] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [cloudOptIn, setCloudOptIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rcReady, setRcReady] = useState(false);
  const [access, setAccess] = useState<CustomerAccess | null>(null);
  const [packages, setPackages] = useState<ProPackage[]>([]);

  const reload = useCallback(async () => {
    const session = await getProSession();
    if (!session) return;
    const restored = await session.restore().catch(() => null);
    setUid(restored);
    setSyncReady((await session.getMasterKey()) !== null);
    const db = await getDb();
    if (db) setCloudOptIn((await getSetting(db, CLOUD_OPT_IN_KEY)) === 'true');

    // RevenueCat: configure lazily, then read access + offering (rc-* rules:
    // entitlement.isActive is the only Pro gate).
    const keys = (Constants.expoConfig?.extra as { revenuecat?: RevenueCatKeys } | undefined)
      ?.revenuecat;
    const ok = keys ? await configurePurchases(keys).catch(() => false) : false;
    setRcReady(ok);
    if (ok) {
      setAccess(await getCustomerAccess().catch(() => null));
      setPackages(await getProPackages().catch(() => []));
    }
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

  const pairTv = useCallback(async () => {
    setBusy('pair');
    setError(null);
    try {
      const session = await getProSession();
      if (!session) throw new Error('Erst mit Firebase verbinden');
      const masterKey = await session.getMasterKey();
      if (!masterKey) throw new Error('Sync auf diesem Gerät noch nicht aktiviert');
      router.push('/tv-scanner');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [router]);

  /**
   * Re-wraps the existing master key with a NEW recovery code (the master key
   * itself — and thus all synced data — stays untouched). Exists because the
   * code is shown exactly once and users lose it (happened 2026-07-26).
   */
  const renewRecoveryCode = useCallback(async () => {
    setBusy('renew');
    setError(null);
    try {
      const session = await getProSession();
      if (!session) throw new Error('Erst mit Firebase verbinden');
      const masterKey = await session.getMasterKey();
      if (!masterKey) throw new Error('Auf diesem Gerät liegt kein Master-Key');
      const recoveryCode = generateRecoveryCode();
      const wrapped = await wrapMasterKey(masterKey, recoveryCode);
      await uploadWrappedKey(session, bytesToBase64(wrapped));
      Alert.alert(
        'Neuer Recovery-Code',
        `${formatRecoveryCode(recoveryCode)}\n\nErsetzt den alten Code (der ist ab jetzt ungültig). Bitte diesmal notieren — nur damit kommen weitere Geräte an deine Daten.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, []);

  const buy = useCallback(async (identifier: string) => {
    setBusy('buy');
    setError(null);
    try {
      setAccess(await purchasePackage(identifier));
    } catch (cause) {
      // userCancelled is a normal outcome — stay silent (rc-error-handling).
      const message = cause instanceof Error ? cause.message : String(cause);
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setBusy(null);
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy('restore');
    setError(null);
    try {
      const result = await restorePurchases();
      setAccess(result);
      if (!result.isPro) setError('Keine aktiven Käufe gefunden.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
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

      {rcReady &&
        (access?.isPro ? (
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.success }]}>
            Pro aktiv{access.store ? ` (${access.store})` : ''}
          </Text>
        ) : (
          <>
            {packages.map((pkg) => (
              <Button
                key={pkg.identifier}
                label={`Pro ${pkg.period === 'monthly' ? 'monatlich' : pkg.period === 'annual' ? 'jährlich' : ''} — ${pkg.priceString}`}
                onPress={() => void buy(pkg.identifier)}
                disabled={busy !== null}
              />
            ))}
            {packages.length > 0 && (
              <Pressable
                onPress={() => void restore()}
                accessibilityRole="button"
                accessibilityLabel="Käufe wiederherstellen"
                style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.accentPrimary }]}>
                  Käufe wiederherstellen
                </Text>
              </Pressable>
            )}
          </>
        ))}

      {uid ? (
        <>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Firebase verbunden ({uid.slice(0, 8)}…)
          </Text>

          {syncReady ? (
            <>
              <Button
                label={busy === 'sync' ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
                onPress={() => void syncNow()}
                disabled={busy !== null}
              />
              <Button
                label={busy === 'pair' ? 'Prüfe…' : 'Apple TV koppeln (QR)'}
                onPress={() => void pairTv()}
                disabled={busy !== null}
              />
              <Pressable
                onPress={() => void renewRecoveryCode()}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Recovery-Code erneuern"
                style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.accentPrimary }]}>
                  Recovery-Code erneuern (alter wird ungültig)
                </Text>
              </Pressable>
            </>
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
