import Ionicons from '@expo/vector-icons/Ionicons';
import { Slot, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { isTV, useBreakpoint } from '@/core/platform';
import { useTheme } from '@/core/theme';
import { useAuth } from '@/features/auth/auth-context';
import { LoginScreen } from '@/features/auth/login-screen';
import { navItems, navLabel } from '@/features/shell/nav-items';
import { SideNav } from '@/features/shell/side-nav';
import { TVApp } from '@/features/tv/tv-app';

/**
 * Responsive shell (DESIGN.md §3): bottom tabs on phone (<600), navigation
 * rail on tablet (600–1024), sidebar on web/desktop (>1024), 10-foot UI on
 * tvOS (phase 12).
 * Gates on auth: signed-out users see the login screen (DESIGN 5.1). TV is a
 * consumption view without sign-in (data arrives via Pro sync) and renders
 * its own shell before the gate.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const breakpoint = useBreakpoint();
  const { status } = useAuth();

  if (isTV) {
    return <TVApp />;
  }

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bgBase }]}>
        <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
      </View>
    );
  }
  if (status === 'signedOut') {
    return <LoginScreen />;
  }

  if (breakpoint !== 'phone') {
    return (
      <View style={[styles.row, { backgroundColor: theme.colors.bgBase }]}>
        <SideNav variant={breakpoint === 'tablet' ? 'rail' : 'sidebar'} />
        <Slot />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentPrimary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.lineSubtle,
        },
      }}
    >
      {navItems.map((item) => (
        <Tabs.Screen
          key={item.key}
          name={item.key === 'home' ? 'index' : item.key}
          options={{
            title: navLabel(item.key),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={(focused ? item.iconActive : item.icon) as never}
                color={color}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
