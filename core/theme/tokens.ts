/**
 * Spacing, radius, typography and layout tokens from docs/DESIGN.md §2.2–§2.3.
 * Breakpoints live in core/platform (used by the shell).
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Card padding per form factor (DESIGN §2.3). */
export const cardPadding = { phone: spacing.lg, tablet: spacing.xl } as const;

export const radius = {
  /** Chips, badges. */
  sm: 8,
  /** Buttons, inputs, rail thumbnails. */
  md: 12,
  /** Cards, hero thumbnails. */
  lg: 16,
  /** Sheets. */
  xl: 24,
} as const;

/** Minimum touch targets (DESIGN §2.3). */
export const touchTarget = {
  default: 44,
  guideMode: 64,
  tvFocus: 72,
} as const;

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '600' | '700';
}

export const typography: Record<
  'display' | 'title1' | 'title2' | 'title3' | 'body' | 'bodyStrong' | 'step' | 'caption' | 'mono',
  TextStyle
> = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title1: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  title2: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  title3: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  step: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
};

/** TV scales all type ×1.5 (10-foot UI, DESIGN §2.2). */
export const tvTypeScale = 1.5;

/**
 * System font stack — no custom font in v1 (DESIGN §2.2).
 * Native platforms use their default family when undefined is passed.
 */
export const fontFamily = {
  default: undefined as string | undefined,
  mono: 'monospace',
  web: 'system-ui, -apple-system, "Segoe UI", Roboto',
};
