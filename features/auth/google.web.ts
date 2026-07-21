import { getGoogleOAuthConfig, GOOGLE_SCOPES, YOUTUBE_FORCE_SSL_SCOPE } from './config';

/**
 * Web Google sign-in via Google Identity Services token client
 * (ARCHITECTURE §7). Implicit flow: short-lived access tokens, silent
 * re-request while the Google session is alive. Native uses google.ts.
 */

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number;
  email: string | null;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoadPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoadPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

async function requestToken(
  prompt: '' | 'consent',
  extraScopes: string[] = [],
): Promise<GoogleTokens | null> {
  await loadGis();
  const { webClientId } = getGoogleOAuthConfig();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new Error('GIS not available');

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: webClientId,
      scope: [...GOOGLE_SCOPES, ...extraScopes].join(' '),
      callback: (response) => {
        if (response.error || !response.access_token) {
          resolve(null);
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
          email: null, // filled from userinfo by the auth context
        });
      },
      error_callback: (error) => reject(error instanceof Error ? error : new Error(String(error))),
    });
    client.requestAccessToken({ prompt });
  });
}

export async function googleSignIn(): Promise<GoogleTokens | null> {
  return requestToken('consent');
}

/** Silent refresh — resolves null when user interaction is required. */
export async function googleRefresh(): Promise<GoogleTokens | null> {
  try {
    return await requestToken('');
  } catch {
    return null;
  }
}

export async function googleSignOut(accessToken?: string): Promise<void> {
  if (accessToken && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) =>
      window.google!.accounts.oauth2.revoke(accessToken, resolve),
    );
  }
}

/**
 * Incremental scope upgrade (M9): consent screen for youtube.force-ssl only
 * (already-granted scopes carry over in GIS).
 */
export async function googleRequestForceSsl(): Promise<GoogleTokens | null> {
  return requestToken('consent', [YOUTUBE_FORCE_SSL_SCOPE]);
}
