import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import { useTheme } from '@/core/theme';
import { AuthProvider } from '@/features/auth/auth-context';

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    getDb().catch((error) => console.error('[db] init failed', error));
    // RevenueCat configures deliberately NOT here: with SDK keys present,
    // configure would phone home on every launch — also for free users,
    // which violates the local-only rule for the free tier (ADR §7.6:
    // "Free ohne Pro sehen keinerlei Server-Traffic"). The SDK configures
    // lazily when the Pro section is opened (features/pro/pro-section).
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bgBase },
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
