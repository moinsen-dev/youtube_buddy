import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { isTV } from '@/core/platform';
import { touchTarget, useTheme } from '@/core/theme';

/**
 * TV focusable wrapper (phase 12, DESIGN §2.3): on tvOS every interactive
 * element gets the amber focus ring (3 px) + scale 1.04; focus transitions
 * run 150 ms (DESIGN §2.4). On phone/web it renders as a plain Pressable.
 */
export function Focusable({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, focused }) => [
        style,
        isTV && styles.tvTarget,
        isTV &&
          focused && {
            borderColor: theme.colors.accentPrimary,
            transform: [{ scale: 1.04 }],
          },
        !isTV && pressed && { opacity: 0.85 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tvTarget: {
    minWidth: touchTarget.tvFocus,
    minHeight: touchTarget.tvFocus,
    borderWidth: 3,
    borderColor: 'transparent',
  },
});
