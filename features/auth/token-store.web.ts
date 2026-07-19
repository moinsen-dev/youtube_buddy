/**
 * Web token store (sessionStorage — survives reloads, cleared with the tab,
 * ARCHITECTURE §7). Native uses token-store.ts (expo-secure-store).
 */

export interface StoredAuth {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
  email: string | null;
}

const KEY = 'google.auth.v1';

export async function loadStoredAuth(): Promise<StoredAuth | null> {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export async function saveStoredAuth(auth: StoredAuth): Promise<void> {
  sessionStorage.setItem(KEY, JSON.stringify(auth));
}

export async function clearStoredAuth(): Promise<void> {
  sessionStorage.removeItem(KEY);
}
