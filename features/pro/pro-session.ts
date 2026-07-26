import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  refreshFirebaseIdentity,
  signInWithCustomToken,
  signInWithGoogle,
  type FirebaseIdentity,
} from '@/core/sync/firebase-auth';
import {
  generateMasterKey,
  generateRecoveryCode,
  unwrapMasterKey,
  wrapMasterKey,
} from '@/core/sync/crypto';

/**
 * Pro session (ADR PRD §7.6): Firebase identity derived from the existing
 * Google sign-in + master-key custody for E2E sync. Storage is injectable —
 * native uses expo-secure-store, web falls back to localStorage (v1 sync
 * targets native; web is read-only for Pro).
 */

export interface SecretStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}

export interface FirebaseEnvConfig {
  projectId: string;
  apiKey: string;
  appId: string;
  analyzeUrl: string;
}

/** Firebase config for the current environment (undefined → Pro disabled). */
export function getFirebaseConfig(): FirebaseEnvConfig | undefined {
  const extra = Constants.expoConfig?.extra as { firebase?: FirebaseEnvConfig } | undefined;
  return extra?.firebase;
}

const KEYS = {
  refreshToken: 'firebase.refresh_token',
  uid: 'firebase.uid',
  masterKey: 'sync.master_key',
} as const;

const REFRESH_MARGIN_MS = 60 * 1000;

/** Loads expo-secure-store lazily (native-only import, web-safe). */
export async function createSecureStorage(): Promise<SecretStorage> {
  if (Platform.OS === 'web') {
    // Web: expo-secure-store has no implementation ('getValueWithKeyAsync is
    // not a function', verified on web phase 11). localStorage is plain text
    // — acceptable for the dev environment; the E2E master key should be
    // treated as native-only until a WebCrypto-wrapped storage lands.
    return {
      getItem: async (key) => Promise.resolve(localStorage.getItem(key)),
      setItem: async (key, value) => {
        localStorage.setItem(key, value);
      },
      deleteItem: async (key) => {
        localStorage.removeItem(key);
      },
    };
  }
  const SecureStore = await import('expo-secure-store');
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

export class ProSession {
  private identity: FirebaseIdentity | null = null;

  constructor(
    private readonly config: FirebaseEnvConfig,
    private readonly storage: SecretStorage,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** Signs into Firebase with the app's Google credential (id or access token). */
  async signInWithGoogleCredential(credential: {
    idToken?: string | null;
    accessToken?: string | null;
  }): Promise<string> {
    this.identity = await signInWithGoogle(this.config.apiKey, credential, this.fetchFn);
    await this.storage.setItem(KEYS.refreshToken, this.identity.refreshToken);
    await this.storage.setItem(KEYS.uid, this.identity.uid);
    return this.identity.uid;
  }

  /** Signs into Firebase with a custom token (phase 12, TV pairing flow). */
  async signInWithPairingToken(customToken: string): Promise<string> {
    this.identity = await signInWithCustomToken(this.config.apiKey, customToken, this.fetchFn);
    await this.storage.setItem(KEYS.refreshToken, this.identity.refreshToken);
    await this.storage.setItem(KEYS.uid, this.identity.uid);
    return this.identity.uid;
  }

  /** Restores a persisted session (null when never signed in). */
  async restore(): Promise<string | null> {
    const refreshToken = await this.storage.getItem(KEYS.refreshToken);
    if (!refreshToken) return null;
    this.identity = await refreshFirebaseIdentity(this.config.apiKey, refreshToken, this.fetchFn);
    await this.storage.setItem(KEYS.refreshToken, this.identity.refreshToken);
    return this.identity.uid;
  }

  async signOut(): Promise<void> {
    this.identity = null;
    await this.storage.deleteItem(KEYS.refreshToken);
    await this.storage.deleteItem(KEYS.uid);
    await this.storage.deleteItem(KEYS.masterKey);
  }

  /** Fresh ID token (refreshes ~1 h tokens transparently). */
  async getIdToken(): Promise<string> {
    if (!this.identity) {
      const uid = await this.restore();
      if (!uid || !this.identity) throw new Error('ProSession: not signed in');
    }
    if (this.identity!.expiresAt - REFRESH_MARGIN_MS < Date.now()) {
      this.identity = await refreshFirebaseIdentity(
        this.config.apiKey,
        this.identity!.refreshToken,
        this.fetchFn,
      );
      await this.storage.setItem(KEYS.refreshToken, this.identity.refreshToken);
    }
    return this.identity!.idToken;
  }

  async getUid(): Promise<string> {
    const stored = await this.storage.getItem(KEYS.uid);
    if (stored) return stored;
    await this.getIdToken(); // restores identity
    return this.identity!.uid;
  }

  /** Local master key (null until sync is enabled on this device). */
  async getMasterKey(): Promise<Uint8Array | null> {
    const raw = await this.storage.getItem(KEYS.masterKey);
    if (!raw) return null;
    const binary = atob(raw);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  /**
   * Enables sync on the FIRST device: new master key + recovery code; the
   * wrapped key goes to Firestore so further devices can unwrap it with the
   * code. Returns the recovery code exactly once (user writes it down).
   */
  async enableSync(uploadWrapped: (wrappedB64: string) => Promise<void>): Promise<string> {
    const masterKey = generateMasterKey();
    const recoveryCode = generateRecoveryCode();
    const wrapped = await wrapMasterKey(masterKey, recoveryCode);
    await uploadWrapped(toBase64(wrapped));
    await this.storeMasterKey(masterKey);
    return recoveryCode;
  }

  /** Joins sync on a FURTHER device via the recovery code. */
  async joinSync(recoveryCode: string, fetchWrapped: () => Promise<string | null>): Promise<void> {
    const wrappedB64 = await fetchWrapped();
    if (!wrappedB64)
      throw new Error('Kein Sync-Schlüssel gefunden — Sync zuerst auf dem Hauptgerät aktivieren');
    const masterKey = await unwrapMasterKey(fromBase64(wrappedB64), recoveryCode);
    await this.storeMasterKey(masterKey);
  }

  /**
   * Adopts a master key received via the QR pairing channel (phase 12, TV
   * flow): the key was sealed for this device's ephemeral key by an already
   * paired device — no recovery code involved.
   */
  async adoptMasterKey(masterKey: Uint8Array): Promise<void> {
    if (masterKey.length !== 32) throw new Error('ProSession: master key must be 32 bytes');
    await this.storeMasterKey(masterKey);
  }

  private async storeMasterKey(masterKey: Uint8Array): Promise<void> {
    await this.storage.setItem(KEYS.masterKey, toBase64(masterKey));
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
