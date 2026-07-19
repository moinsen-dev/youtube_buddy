import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { googleRefresh, googleSignIn, googleSignOut } from './google';
import { clearStoredAuth, loadStoredAuth, saveStoredAuth, type StoredAuth } from './token-store';

/**
 * Auth state machine (ARCHITECTURE §7): loading → signedOut | signedIn.
 * Token refresh is silent and handled centrally here.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  email: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh 60 s before expiry. */
const EXPIRY_MARGIN_MS = 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<StoredAuth | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await loadStoredAuth();
      if (existing && existing.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
        if (!cancelled) {
          setStored(existing);
          setStatus('signedIn');
        }
        return;
      }
      const refreshed = await googleRefresh();
      if (cancelled) return;
      if (refreshed) {
        const next: StoredAuth = {
          ...refreshed,
          scopes: existing?.scopes ?? [],
          email: refreshed.email ?? existing?.email ?? (await fetchEmail(refreshed.accessToken)),
        };
        await saveStoredAuth(next);
        setStored(next);
        setStatus('signedIn');
      } else {
        await clearStoredAuth();
        setStatus('signedOut');
      }
    })().catch(() => setStatus('signedOut'));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const tokens = await googleSignIn();
    if (!tokens) return; // user cancelled
    const next: StoredAuth = {
      ...tokens,
      scopes: [],
      email: tokens.email ?? (await fetchEmail(tokens.accessToken)),
    };
    await saveStoredAuth(next);
    setStored(next);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await googleSignOut(stored?.accessToken);
    await clearStoredAuth();
    setStored(null);
    setStatus('signedOut');
  }, [stored?.accessToken]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (stored && stored.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      return stored.accessToken;
    }
    const refreshed = await googleRefresh();
    if (!refreshed) {
      setStatus('signedOut');
      return null;
    }
    const next: StoredAuth = {
      ...refreshed,
      scopes: stored?.scopes ?? [],
      email: stored?.email ?? refreshed.email,
    };
    await saveStoredAuth(next);
    setStored(next);
    return next.accessToken;
  }, [stored]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, email: stored?.email ?? null, signIn, signOut, getAccessToken }),
    [status, stored?.email, signIn, signOut, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Fetches the user's email via the Google OAuth userinfo endpoint
 * (whitelisted as Google OAuth, PRD §7). */
async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}
