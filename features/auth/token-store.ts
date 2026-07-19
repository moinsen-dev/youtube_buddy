import * as SecureStore from 'expo-secure-store';

/**
 * Native token store (expo-secure-store, ARCHITECTURE §7).
 * Web uses token-store.web.ts (sessionStorage) instead.
 */

export interface StoredAuth {
  accessToken: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
  scopes: string[];
  email: string | null;
}

const KEY = 'google.auth.v1';

export async function loadStoredAuth(): Promise<StoredAuth | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export async function saveStoredAuth(auth: StoredAuth): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(auth));
}

export async function clearStoredAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
