import { getRandomBytes } from 'expo-crypto';
import * as nacl from 'tweetnacl';

/** Runtime shape of nacl.box (X25519-XSalsa20-Poly1305). */
interface NaclBox {
  (msg: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array;
  open: (
    msg: Uint8Array,
    nonce: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array,
  ) => Uint8Array | null;
  nonceLength: number;
  secretKeyLength: number;
  keyPair: {
    fromSecretKey: (secretKey: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
  };
}

// nacl.d.ts exposes `box` only as a type member, not a value export (same
// quirk that lets `secretbox` import directly) — it exists at runtime on
// both nacl.js and nacl-fast.js.
const box = (nacl as unknown as { box: NaclBox }).box;

/**
 * ECIES helpers for TV pairing v2 (phase 12): the TV generates an ephemeral
 * Curve25519 keypair and shows it (via QR session); the phone seals the
 * master key with the TV's public key (nacl box = X25519-XSalsa20-Poly1305).
 * The pairing function only relays the sealed blob — the server stays blind
 * (ADR PRD §7.6) and no recovery code is needed for device pairing.
 */

export interface EphemeralKeyPair {
  publicKeyB64: string;
  secretKeyB64: string;
}

/** Ephemeral Curve25519 keypair (TV side, per pairing session). */
export function generateEphemeralKeyPair(): EphemeralKeyPair {
  const keyPair = box.keyPair.fromSecretKey(getRandomBytes(box.secretKeyLength));
  return {
    publicKeyB64: toBase64(keyPair.publicKey),
    secretKeyB64: toBase64(keyPair.secretKey),
  };
}

export interface SealedMasterKey {
  nonceB64: string;
  /** Sealer's ephemeral public key (needed by the opener). */
  publicKeyB64: string;
  sealedB64: string;
}

/** Phone side: seals the master key for the TV's public key. */
export function sealMasterKey(masterKey: Uint8Array, tvPublicKeyB64: string): SealedMasterKey {
  const ephemeral = box.keyPair.fromSecretKey(getRandomBytes(box.secretKeyLength));
  const nonce = getRandomBytes(box.nonceLength);
  const sealed = box(masterKey, nonce, fromBase64(tvPublicKeyB64), ephemeral.secretKey);
  return {
    nonceB64: toBase64(nonce),
    publicKeyB64: toBase64(ephemeral.publicKey),
    sealedB64: toBase64(sealed),
  };
}

/** TV side: opens the sealed master key; throws on tampering. */
export function openSealedMasterKey(sealed: SealedMasterKey, tvSecretKeyB64: string): Uint8Array {
  const opened = box.open(
    fromBase64(sealed.sealedB64),
    fromBase64(sealed.nonceB64),
    fromBase64(sealed.publicKeyB64),
    fromBase64(tvSecretKeyB64),
  );
  if (!opened || opened.length !== 32) {
    throw new Error('Master-Key konnte nicht entsiegelt werden (Pairing-Daten ungültig)');
  }
  return opened;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
