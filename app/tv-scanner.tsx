import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sealMasterKey } from '@/core/sync/ecies';
import { useTheme } from '@/core/theme';
import { getProSession } from '@/features/pro/pro-engine';
import { completeTvPairing } from '@/features/pro/tv-pairing';

interface PairingPayload {
  v: number;
  session: string;
  pub: string;
}

/**
 * QR scanner for TV pairing (phase 12): scans the code shown on the Apple
 * TV, asks for confirmation and seals the master key for the TV's ephemeral
 * public key — the pairing function only relays ciphertext.
 */
export default function TvScannerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [payload, setPayload] = useState<PairingPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (payload || busy) return;
      try {
        const parsed = JSON.parse(data) as PairingPayload;
        if (parsed.v !== 1 || !parsed.session || !parsed.pub) return;
        setPayload(parsed);
        setError(null);
      } catch {
        // not a pairing QR — keep scanning
      }
    },
    [payload, busy],
  );

  const confirm = useCallback(async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const session = await getProSession();
      if (!session) throw new Error('Erst in den Pro-Einstellungen mit Firebase verbinden');
      const masterKey = await session.getMasterKey();
      if (!masterKey) throw new Error('Sync auf diesem Gerät noch nicht aktiviert');
      const sealed = sealMasterKey(masterKey, payload.pub);
      await completeTvPairing(session, {
        sessionId: payload.session,
        nonceB64: sealed.nonceB64,
        publicKeyB64: sealed.publicKeyB64,
        sealedB64: sealed.sealedB64,
      });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [payload]);

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bgBase }]}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          Kamera-Zugriff wird für das Scannen des TV-Codes gebraucht.
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          accessibilityLabel="Kamera-Zugriff erlauben"
          style={[
            styles.button,
            { backgroundColor: theme.colors.accentPrimary, borderRadius: theme.radius.md },
          ]}
        >
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
            Kamera erlauben
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bgBase }]}>
      {!payload && !done && (
        <>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <Text style={[theme.typography.body, styles.hint, { color: theme.colors.textSecondary }]}>
            QR-Code auf dem TV-Bildschirm scannen
          </Text>
        </>
      )}

      {payload && !done && (
        <View style={styles.center}>
          <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
            Diesen Apple TV koppeln?
          </Text>
          <Text style={[theme.typography.body, styles.hint, { color: theme.colors.textSecondary }]}>
            Der Sync-Schlüssel wird versiegelt übertragen — der Server sieht nur Chiffretext.
          </Text>
          <Pressable
            onPress={() => void confirm()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Koppeln bestätigen"
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.accentPrimary,
                borderRadius: theme.radius.md,
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
              {busy ? 'Kopple …' : 'Koppeln'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPayload(null)}
            accessibilityRole="button"
            accessibilityLabel="Erneut scannen"
            style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
          >
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Erneut scannen
            </Text>
          </Pressable>
        </View>
      )}

      {done && (
        <View style={styles.center}>
          <Text style={[theme.typography.title3, { color: theme.colors.success }]}>
            Gekoppelt — der TV synchronisiert jetzt.
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            style={[
              styles.button,
              { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.md },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              Fertig
            </Text>
          </Pressable>
        </View>
      )}

      {error && (
        <Text style={[theme.typography.body, styles.error, { color: theme.colors.danger }]}>
          {error}
        </Text>
      )}

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Abbrechen"
        style={styles.close}
      >
        <Text style={[theme.typography.title3, { color: theme.colors.textSecondary }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  camera: { flex: 1 },
  hint: { textAlign: 'center', padding: 16, maxWidth: 420 },
  error: { textAlign: 'center', padding: 16 },
  button: { paddingHorizontal: 32, paddingVertical: 16 },
  close: { position: 'absolute', top: 60, right: 24, padding: 12 },
});
