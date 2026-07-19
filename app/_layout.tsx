import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import { useTheme } from '@/core/theme';

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    getDb().catch((error) => console.error('[db] init failed', error));
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bgBase },
        }}
      />
    </SafeAreaProvider>
  );
}
