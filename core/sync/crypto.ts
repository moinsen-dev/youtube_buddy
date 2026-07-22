import { getRandomBytes } from 'expo-crypto';
import { scrypt } from '@noble/hashes/scrypt.js';
import { secretbox } from 'tweetnacl';

/**
 * E2E crypto for Pro-Sync (ADR PRD §7.6): the server is blind.
 *
 * Model: a random 256-bit master key encrypts every synced entity
 * (XSalsa20-Poly1305 via tweetnacl secretbox — authenticated encryption).
 * The master key itself is wrapped with a key derived from the recovery
 * code (scrypt) and only the wrapped blob leaves the device — a second
 * device unwraps it with the same code. Randomness comes from expo-crypto
 * (tweetnacl's own PRNG does not exist in Hermes — 'no PRNG').
 */

export const MASTER_KEY_BYTES = 32;
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // base32, no lookalikes
export const RECOVERY_CODE_LENGTH = 24; // groups of 4 for display

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 32 };

/** Random 256-bit master key. */
export function generateMasterKey(): Uint8Array {
  return getRandomBytes(MASTER_KEY_BYTES);
}

/** Human-readable recovery code, e.g. 'XXXX-XXXX-…' (24 chars in 6 groups). */
export function generateRecoveryCode(): string {
  const bytes = getRandomBytes(RECOVERY_CODE_LENGTH);
  const chars = Array.from(bytes, (b) => RECOVERY_CODE_ALPHABET[b % RECOVERY_CODE_ALPHABET.length]);
  return chars.join('');
}

/** Display form: groups of 4 separated by dashes. */
export function formatRecoveryCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

/** Strips dashes/spaces and uppercases — tolerant input handling. */
export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase();
}

async function deriveWrapKey(code: string, salt: Uint8Array): Promise<Uint8Array> {
  const { N, r, p, dkLen } = SCRYPT_PARAMS;
  const password = new TextEncoder().encode(normalizeRecoveryCode(code));
  // @noble/hashes: scrypt-js computes a WRONG key on iOS-Hermes (identical
  // inputs, divergent output — verified on device; node/Android fine).
  // noble matches the reference on every platform we tested.
  return scrypt(password, salt, { N, r, p, dkLen });
}

/**
 * Wraps the master key for server storage: scrypt(recovery code, salt) →
 * secretbox(master key). Output = salt ‖ nonce ‖ box (all non-secret).
 */
export async function wrapMasterKey(
  masterKey: Uint8Array,
  recoveryCode: string,
): Promise<Uint8Array> {
  const salt = getRandomBytes(16);
  const nonce = getRandomBytes(secretbox.nonceLength);
  const wrapKey = await deriveWrapKey(recoveryCode, salt);
  const box = secretbox(masterKey, nonce, wrapKey);
  const out = new Uint8Array(salt.length + nonce.length + box.length);
  out.set(salt, 0);
  out.set(nonce, salt.length);
  out.set(box, salt.length + nonce.length);
  return out;
}

/** Inverse of wrapMasterKey; throws on a wrong recovery code or corruption. */
export async function unwrapMasterKey(
  wrapped: Uint8Array,
  recoveryCode: string,
): Promise<Uint8Array> {
  const salt = wrapped.slice(0, 16);
  const nonce = wrapped.slice(16, 16 + secretbox.nonceLength);
  const box = wrapped.slice(16 + secretbox.nonceLength);
  const wrapKey = await deriveWrapKey(recoveryCode, salt);
  const masterKey = secretbox.open(box, nonce, wrapKey);
  if (!masterKey || masterKey.length !== MASTER_KEY_BYTES) {
    throw new Error('Recovery-Code passt nicht (Master-Key konnte nicht entschlüsselt werden)');
  }
  return masterKey;
}

/** Encrypts a JSON payload: output = nonce ‖ box, base64 for storage. */
export function encryptPayload(masterKey: Uint8Array, payload: unknown): string {
  const nonce = getRandomBytes(secretbox.nonceLength);
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const box = secretbox(message, nonce, masterKey);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce, 0);
  out.set(box, nonce.length);
  return toBase64(out);
}

/** Inverse of encryptPayload; throws on tampering or wrong key. */
export function decryptPayload<T>(masterKey: Uint8Array, ciphertext: string): T {
  const bytes = fromBase64(ciphertext);
  const nonce = bytes.slice(0, secretbox.nonceLength);
  const box = bytes.slice(secretbox.nonceLength);
  const message = secretbox.open(box, nonce, masterKey);
  if (!message) {
    throw new Error('Ciphertext ungültig (falscher Schlüssel oder manipuliert)');
  }
  return JSON.parse(new TextDecoder().decode(message)) as T;
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
