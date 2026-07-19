import { Platform, useWindowDimensions } from 'react-native';

/**
 * Breakpoints from docs/DESIGN.md §3:
 *   phone  < 600         → bottom tabs
 *   tablet 600–1024      → navigation rail (80 pt)
 *   web    > 1024        → sidebar (240 px)
 */
export type Breakpoint = 'phone' | 'tablet' | 'web';

export const breakpoints = { phone: 0, tablet: 600, web: 1024 } as const;

export function resolveBreakpoint(width: number): Breakpoint {
  if (width > breakpoints.web) return 'web';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'phone';
}

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return resolveBreakpoint(width);
}

export const isWeb = Platform.OS === 'web';
/** tvOS target arrives in phase 12 (react-native-tvos). */
export const isTV = Platform.isTV;
