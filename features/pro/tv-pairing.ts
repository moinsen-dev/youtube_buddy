import { getFirebaseConfig, type ProSession } from './pro-session';

/**
 * TV pairing v2 client (phase 12, QR flow): the TV opens a session with its
 * ephemeral public key; the phone (signed in, Pro) completes it after a QR
 * scan by sealing the master key for that key; the TV polls. The function
 * only relays ciphertext — the master key never touches the server in the
 * clear. Sessions: 10 min TTL, single-use, unguessable id.
 */

export interface TvPairingCompletion {
  nonceB64: string;
  phonePublicKeyB64: string;
  sealedBoxB64: string;
  customToken: string;
}

function functionsBase(): string {
  const config = getFirebaseConfig();
  if (!config) throw new Error('Keine Firebase-Konfiguration für diese Umgebung');
  return new URL(config.analyzeUrl).origin;
}

/** TV side: opens a pairing session for the TV's ephemeral public key. */
export async function createTvPairingSession(publicKeyB64: string): Promise<string> {
  const response = await fetch(`${functionsBase()}/createTvPairingSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey: publicKeyB64 }),
  });
  const body = (await response.json()) as { sessionId?: string; error?: string };
  if (!response.ok || !body.sessionId) {
    throw new Error(`Pairing-Session fehlgeschlagen (${response.status})`);
  }
  return body.sessionId;
}

/** Phone side: completes the session after the QR scan + confirm. */
export async function completeTvPairing(
  session: ProSession,
  params: { sessionId: string; nonceB64: string; publicKeyB64: string; sealedB64: string },
): Promise<void> {
  const idToken = await session.getIdToken();
  const response = await fetch(`${functionsBase()}/completeTvPairing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: params.sessionId,
      nonce: params.nonceB64,
      phonePublicKey: params.publicKeyB64,
      sealedBox: params.sealedB64,
    }),
  });
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(`Kopplung fehlgeschlagen (${response.status}): ${body.error ?? '?'}`);
  }
}

/**
 * TV side: polls the session. Resolves with the completion once the phone
 * finished, or null while pending. Throws when the session expired or was
 * already consumed.
 */
export async function pollTvPairing(sessionId: string): Promise<TvPairingCompletion | null> {
  const response = await fetch(`${functionsBase()}/pollTvPairing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (response.status === 202) return null;
  if (!response.ok) {
    throw new Error(`Pairing-Session ungültig oder abgelaufen (${response.status})`);
  }
  const body = (await response.json()) as {
    nonce: string;
    phonePublicKey: string;
    sealedBox: string;
    customToken: string;
  };
  return {
    nonceB64: body.nonce,
    phonePublicKeyB64: body.phonePublicKey,
    sealedBoxB64: body.sealedBox,
    customToken: body.customToken,
  };
}
