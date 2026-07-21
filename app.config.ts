import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

/**
 * Environment switch (firebase-environments stack convention, ADR PRD §7.6):
 * EXPO_PUBLIC_ENV selects the Firebase project — development is the default
 * everywhere; production config lands with the prod rollout (explicit
 * approval required, see docs/AGENT-TOOLING.md).
 *
 * Values are public client identifiers (Firebase apiKey is a browser key,
 * security enforced by Firestore rules + App Check later), never secrets.
 */

const ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';

interface FirebaseEnvConfig {
  projectId: string;
  apiKey: string;
  appId: string;
  /** Cloud Function endpoint for the CloudEngine (Gemini proxy, EU). */
  analyzeUrl: string;
}

const FIREBASE_CONFIGS: Record<string, FirebaseEnvConfig> = {
  development: {
    projectId: 'youtube-buddy-moinsen-dev',
    apiKey: 'AIzaSyA6b-b-a7UZlK0MpYYZvrMbZ6zEka8jf0g',
    appId: '1:732512553008:web:dc1ac8c2404152cecb05f5',
    analyzeUrl: 'https://europe-west3-youtube-buddy-moinsen-dev.cloudfunctions.net/analyze',
  },
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(appJson.expo as ExpoConfig),
  ...config,
  extra: {
    ...appJson.expo.extra,
    env: ENV,
    // Undefined outside known environments → Pro features stay disabled.
    firebase: FIREBASE_CONFIGS[ENV],
  },
});
