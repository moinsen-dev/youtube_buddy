import { tvTypeScale, type TextStyle } from '@/core/theme/tokens';

/**
 * 10-foot typography (DESIGN §2.2): every type style ×1.5 on TV, so body
 * stays ≥ 24 px. Used by all features/tv screens instead of theme.typography.
 */
export function tvType(style: TextStyle): TextStyle {
  return {
    fontSize: Math.round(style.fontSize * tvTypeScale),
    lineHeight: Math.round(style.lineHeight * tvTypeScale),
    fontWeight: style.fontWeight,
  };
}
