import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import { useTheme } from '@/core/theme';
import { AuthProvider } from '@/features/auth/auth-context';
import { configurePurchases, type RevenueCatKeys } from '@/features/pro/purchases';

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    getDb().catch((error) => console.error('[db] init failed', error));
    // RevenueCat (Pro-Tier): configures only when public SDK keys exist —
    // without them the module stays inert (dev mode, see STATE.md).
    const keys = (Constants.expoConfig?.extra as { revenuecat?: RevenueCatKeys } | undefined)
      ?.revenuecat;
    if (keys) {
      configurePurchases(keys).catch((error) =>
        console.warn('[purchases] configure failed', error),
      );
    }
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
