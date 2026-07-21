import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

import { getGoogleOAuthConfig, GOOGLE_SCOPES, YOUTUBE_FORCE_SSL_SCOPE } from './config';

/**
 * Native Google sign-in (iOS/Android) via @react-native-google-signin
 * (ARCHITECTURE §7). The native SDKs refresh tokens internally — no client
 * secret on device. Web uses google.web.ts (GIS token client).
 */

export interface GoogleTokens {
  accessToken: string;
  /** Epoch milliseconds; native tokens live ~1 h. */
  expiresAt: number;
  email: string | null;
}

let configured = false;

function configure(): void {
  if (configured) return;
  const config = getGoogleOAuthConfig();
  GoogleSignin.configure({
    webClientId: config.webClientId,
    iosClientId: config.iosClientId || undefined,
    scopes: GOOGLE_SCOPES,
  });
  configured = true;
}

export async function googleSignIn(): Promise<GoogleTokens | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return null; // user cancelled
  }
  const tokens = await GoogleSignin.getTokens();
  return {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + 3500 * 1000,
    email: response.data.user.email ?? null,
  };
}

/** Silent refresh — resolves null when the user signed out meanwhile. */
export async function googleRefresh(): Promise<GoogleTokens | null> {
  configure();
  try {
    const response = await GoogleSignin.signInSilently();
    if (response.type !== 'success') return null;
    const tokens = await GoogleSignin.getTokens();
    return {
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 3500 * 1000,
      email: response.data.user.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function googleSignOut(_accessToken?: string): Promise<void> {
  configure();
  try {
    await GoogleSignin.signOut();
  } catch {
    // already signed out
  }
}

/**
 * Incremental scope upgrade (M9): re-configures with youtube.force-ssl and
 * runs an interactive sign-in — Google shows consent for the new scope only.
 * Afterwards every token (also from silent refresh) carries the scope.
 */
export async function googleRequestForceSsl(): Promise<GoogleTokens | null> {
  const config = getGoogleOAuthConfig();
  GoogleSignin.configure({
    webClientId: config.webClientId,
    iosClientId: config.iosClientId || undefined,
    scopes: [...GOOGLE_SCOPES, YOUTUBE_FORCE_SSL_SCOPE],
  });
  configured = true;
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return null; // user cancelled
  }
  const tokens = await GoogleSignin.getTokens();
  return {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + 3500 * 1000,
    email: response.data.user.email ?? null,
  };
}
