import Ionicons from '@expo/vector-icons/Ionicons';
import { Slot, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useBreakpoint } from '@/core/platform';
import { useTheme } from '@/core/theme';
import { navItems, navLabel } from '@/features/shell/nav-items';
import { SideNav } from '@/features/shell/side-nav';

/**
 * Responsive shell (DESIGN.md §3): bottom tabs on phone (<600), navigation
 * rail on tablet (600–1024), sidebar on web/desktop (>1024).
 */
export default function TabsLayout() {
  const theme = useTheme();
  const breakpoint = useBreakpoint();

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
});
