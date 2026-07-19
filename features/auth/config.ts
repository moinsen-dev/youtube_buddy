import Constants from 'expo-constants';

/**
 * OAuth client configuration (ARCHITECTURE §7). Client ids are public values
 * and live in app.json → extra.google (filled in after the GCP setup).
 * Incremental scopes: youtube.force-ssl is only requested on first
 * unsubscribe (M9, phase 10).
 */
export const GOOGLE_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export interface GoogleOAuthConfig {
  webClientId: string;
  iosClientId: string;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const extra = Constants.expoConfig?.extra as { google?: Partial<GoogleOAuthConfig> } | undefined;
  return {
    webClientId: extra?.google?.webClientId ?? '',
    iosClientId: extra?.google?.iosClientId ?? '',
  };
}
