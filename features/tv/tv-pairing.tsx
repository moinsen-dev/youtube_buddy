import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';

import { getDb } from '@/core/db';
import { generateEphemeralKeyPair, openSealedMasterKey } from '@/core/sync/ecies';
import { useTheme } from '@/core/theme';
import { getProSession } from '@/features/pro/pro-engine';
import { runSync } from '@/features/pro/run-sync';
import { createTvPairingSession, pollTvPairing } from '@/features/pro/tv-pairing';

import { Focusable } from './focusable';
import { tvType } from './tv-type';

const POLL_INTERVAL_MS = 2500;

/**
 * TV pairing screen v2 (phase 12, QR flow): the TV shows a QR code with the
 * pairing session; the phone scans it (Mehr → Pro → „Apple TV koppeln"),
 * confirms, and the master key travels sealed straight to the TV — no code
 * typing, no recovery code. Sessions expire after 10 minutes.
 */
export function TVPairing({ onPaired }: { onPaired: () => void }) {
  const theme = useTheme();
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'init' | 'waiting' | 'finishing'>('init');
  const cancelledRef = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        const session = await getProSession();
        if (!session) throw new Error('Keine Firebase-Konfiguration auf diesem Gerät');
        const keys = generateEphemeralKeyPair();
        const sessionId = await createTvPairingSession(keys.publicKeyB64);
        const payload = JSON.stringify({ v: 1, session: sessionId, pub: keys.publicKeyB64 });
        const svg = await QRCode.toString(payload, { type: 'svg', margin: 2, width: 640 });
        if (cancelledRef.current) return;
        setQrSvg(svg);
        setStatus('waiting');

        const deadline = Date.now() + 10 * 60 * 1000;
        const poll = async () => {
          if (cancelledRef.current) return;
          if (Date.now() > deadline) {
            setError('Session abgelaufen — bitte erneut versuchen.');
            return;
          }
          try {
            const completion = await pollTvPairing(sessionId);
            if (completion) {
              setStatus('finishing');
              const masterKey = openSealedMasterKey(
                {
                  nonceB64: completion.nonceB64,
                  publicKeyB64: completion.phonePublicKeyB64,
                  sealedB64: completion.sealedBoxB64,
                },
                keys.secretKeyB64,
              );
              await session.signInWithPairingToken(completion.customToken);
              await session.adoptMasterKey(masterKey);
              const db = await getDb();
              if (db) await runSync(db, session);
              if (!cancelledRef.current) onPaired();
              return;
            }
          } catch (cause) {
            if (!cancelledRef.current) {
              setError(cause instanceof Error ? cause.message : String(cause));
            }
            return;
          }
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        };
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (cause) {
        if (!cancelledRef.current) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <View style={styles.container}>
      <Text style={[tvType(theme.typography.title2), { color: theme.colors.textPrimary }]}>
        Apple TV koppeln
      </Text>

      {!error && (
        <>
          <Text
            style={[
              tvType(theme.typography.body),
              styles.hint,
              { color: theme.colors.textSecondary },
            ]}
          >
            Auf dem Telefon: Mehr → Pro → „Apple TV koppeln“ und diesen Code scannen. Der Schlüssel
            wandert verschlüsselt direkt aufs TV — der Server sieht nur Chiffretext.
          </Text>
          <View
            style={[styles.qrBox, { backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg }]}
          >
            {qrSvg ? (
              <SvgXml xml={qrSvg} width={420} height={420} />
            ) : (
              <Text style={[tvType(theme.typography.body), { color: theme.colors.textTertiary }]}>
                …
              </Text>
            )}
          </View>
          <Text style={[tvType(theme.typography.caption), { color: theme.colors.textTertiary }]}>
            {status === 'waiting' && 'Warte auf Scan … (gültig für 10 Minuten)'}
            {status === 'finishing' && 'Scan erkannt — synchronisiere …'}
            {status === 'init' && 'Bereite Pairing vor …'}
          </Text>
        </>
      )}

      {error && (
        <>
          <Text style={[tvType(theme.typography.body), { color: theme.colors.danger }]}>
            {error}
          </Text>
          <Focusable
            onPress={() => {
              setError(null);
              setStatus('init');
              setQrSvg(null);
              setAttempt((value) => value + 1);
            }}
            accessibilityLabel="Erneut versuchen"
            style={[
              styles.button,
              { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.md },
            ]}
          >
            <Text
              style={[tvType(theme.typography.bodyStrong), { color: theme.colors.textPrimary }]}
            >
              Erneut versuchen
            </Text>
          </Focusable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 32 },
  hint: { maxWidth: 900 },
  qrBox: {
    alignSelf: 'flex-start',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
});
