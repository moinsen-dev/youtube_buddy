import { getGoogleOAuthConfig, GOOGLE_SCOPES, YOUTUBE_FORCE_SSL_SCOPE } from './config';

/**
 * Native Google sign-in (iOS/Android) via @react-native-google-signin
 * (ARCHITECTURE §7). The native SDKs refresh tokens internally — no client
 * secret on device. Web uses google.web.ts (GIS token client).
 *
 * The native module is imported lazily: @react-native-google-signin is not
 * linked on tvOS (phase 12 — TV is a consumption view without sign-in), so a
 * static import crashes the whole bundle there (TurboModuleRegistry error).
 */

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let modulePromise: Promise<GoogleSigninModule> | null = null;

function loadModule(): Promise<GoogleSigninModule> {
  modulePromise ??= import('@react-native-google-signin/google-signin');
  return modulePromise;
}

export interface GoogleTokens {
  accessToken: string;
  /** Epoch milliseconds; native tokens live ~1 h. */
  expiresAt: number;
  email: string | null;
}

let configured = false;

async function configure(): Promise<GoogleSigninModule> {
  const mod = await loadModule();
  if (configured) return mod;
  const config = getGoogleOAuthConfig();
  mod.GoogleSignin.configure({
    webClientId: config.webClientId,
    iosClientId: config.iosClientId || undefined,
    scopes: GOOGLE_SCOPES,
  });
  configured = true;
  return mod;
}

export async function googleSignIn(): Promise<GoogleTokens | null> {
  const mod = await configure();
  await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await mod.GoogleSignin.signIn();
  if (!mod.isSuccessResponse(response)) {
    return null; // user cancelled
  }
  const tokens = await mod.GoogleSignin.getTokens();
  return {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + 3500 * 1000,
    email: response.data.user.email ?? null,
  };
}

/** Silent refresh — resolves null when the user signed out meanwhile. */
export async function googleRefresh(): Promise<GoogleTokens | null> {
  const mod = await configure();
  try {
    const response = await mod.GoogleSignin.signInSilently();
    if (response.type !== 'success') return null;
    const tokens = await mod.GoogleSignin.getTokens();
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
  const mod = await configure();
  try {
    await mod.GoogleSignin.signOut();
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
  const mod = await loadModule();
  const config = getGoogleOAuthConfig();
  mod.GoogleSignin.configure({
    webClientId: config.webClientId,
    iosClientId: config.iosClientId || undefined,
    scopes: [...GOOGLE_SCOPES, YOUTUBE_FORCE_SSL_SCOPE],
  });
  configured = true;
  await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await mod.GoogleSignin.signIn();
  if (!mod.isSuccessResponse(response)) {
    return null; // user cancelled
  }
  const tokens = await mod.GoogleSignin.getTokens();
  return {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + 3500 * 1000,
    email: response.data.user.email ?? null,
  };
}
