import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';
import {
  cardPadding,
  fontFamily,
  radius,
  spacing,
  touchTarget,
  tvTypeScale,
  typography,
} from './tokens';

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  cardPadding: typeof cardPadding;
  radius: typeof radius;
  touchTarget: typeof touchTarget;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  tvTypeScale: number;
}

export function getTheme(scheme: 'light' | 'dark'): Theme {
  return {
    dark: scheme === 'dark',
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    cardPadding,
    radius,
    touchTarget,
    typography,
    fontFamily,
    tvTypeScale,
  };
}

/**
 * Dark-first (DESIGN §1): the app defaults to the dark theme and follows the
 * OS only when the user picked "automatic" (settings toggle arrives with the
 * settings feature in a later phase).
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return getTheme(scheme === 'light' ? 'light' : 'dark');
}

export { darkColors, lightColors } from './colors';
export type { ThemeColors } from './colors';
export { radius, spacing, touchTarget, typography } from './tokens';
