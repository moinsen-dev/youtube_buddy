import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/core/i18n/strings';
import { useBreakpoint } from '@/core/platform';
import { useTheme } from '@/core/theme';

/**
 * Placeholder for phase-0 dummy screens (ROADMAP Phase 0 exit: navigation
 * between the 5 areas works). Real screens replace this per module.
 */
export function DummyScreen({ title }: { title: string }) {
  const theme = useTheme();
  const breakpoint = useBreakpoint();
  const strings = t();

  return (
    <View style={[styles.outer, { backgroundColor: theme.colors.bgBase }]}>
      <View style={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.xl,
            },
          ]}
        >
          <Text style={[theme.typography.title1, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          <Text
            style={[theme.typography.body, styles.subtitle, { color: theme.colors.textSecondary }]}
          >
            {strings.dummy.subtitle}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {strings.dummy.meta(breakpoint, theme.dark ? 'dark' : 'light')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1200, // DESIGN §3: max content width on web/desktop
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    gap: 8,
  },
  subtitle: {
    marginTop: 4,
  },
});
