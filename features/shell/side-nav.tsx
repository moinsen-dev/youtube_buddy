import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';
import { navItems, navLabel } from './nav-items';

export type SideNavVariant = 'rail' | 'sidebar';

/**
 * Left-side navigation for tablet (rail, 80 pt) and web (sidebar, 240 px,
 * DESIGN.md §3). Phone uses bottom tabs instead (see app/(tabs)/_layout).
 */
export function SideNav({ variant }: { variant: SideNavVariant }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isRail = variant === 'rail';

  return (
    <View
      style={[
        styles.container,
        {
          width: isRail ? 80 : 240,
          backgroundColor: theme.colors.bgElevated,
          borderRightColor: theme.colors.lineSubtle,
        },
      ]}
    >
      {!isRail && (
        <Text
          style={[
            theme.typography.title2,
            styles.brand,
            { color: theme.colors.textPrimary, paddingHorizontal: theme.spacing.lg },
          ]}
        >
          YouTube Buddy
        </Text>
      )}
      {navItems.map((item) => {
        const active = item.route === '/' ? pathname === '/' : pathname.startsWith(item.route);
        return (
          <Pressable
            key={item.key}
            onPress={() => router.navigate(item.route as never)}
            accessibilityRole="button"
            accessibilityLabel={navLabel(item.key)}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.item,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: active
                  ? theme.colors.bgOverlay
                  : pressed
                    ? theme.colors.bgOverlay
                    : 'transparent',
                marginHorizontal: isRail ? theme.spacing.sm : theme.spacing.md,
              },
            ]}
          >
            <Ionicons
              name={(active ? item.iconActive : item.icon) as never}
              size={24}
              color={active ? theme.colors.accentPrimary : theme.colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[
                isRail ? theme.typography.caption : theme.typography.body,
                {
                  color: active ? theme.colors.accentPrimary : theme.colors.textSecondary,
                  fontSize: isRail ? 10 : undefined,
                },
              ]}
            >
              {navLabel(item.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRightWidth: 1,
    paddingVertical: 12,
    gap: 4,
  },
  brand: {
    marginBottom: 16,
    marginTop: 8,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
});
