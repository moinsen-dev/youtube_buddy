/**
 * Color tokens from docs/DESIGN.md §2.1.
 *
 * Dark is the default theme. Light uses the same token structure; DESIGN.md
 * specifies only the core values for light — values marked with (derived)
 * complete the set and follow the same tonal steps.
 */

export interface ThemeColors {
  bgBase: string;
  bgElevated: string;
  bgOverlay: string;
  lineSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accentPrimary: string;
  accentPrimaryStrong: string;
  accentOnPrimary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  brandYoutube: string;
}

export const darkColors: ThemeColors = {
  bgBase: '#0F1115',
  bgElevated: '#161A21',
  bgOverlay: '#1E242E',
  lineSubtle: '#262D38',
  textPrimary: '#F2F4F7',
  textSecondary: '#9AA3B2',
  textTertiary: '#6B7484',
  accentPrimary: '#F59E0B',
  accentPrimaryStrong: '#D97706',
  accentOnPrimary: '#1A1205',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF453A',
  info: '#4A9DFF',
  brandYoutube: '#FF0033',
};

export const lightColors: ThemeColors = {
  bgBase: '#FAFAFC',
  bgElevated: '#FFFFFF',
  bgOverlay: '#F2F4F7', // (derived) tonal step below elevated
  lineSubtle: '#E4E7EC',
  textPrimary: '#101828',
  textSecondary: '#475467',
  textTertiary: '#98A2B3', // (derived) same gray family as text/secondary
  accentPrimary: '#F59E0B',
  accentPrimaryStrong: '#D97706',
  accentOnPrimary: '#1A1205',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF453A',
  info: '#4A9DFF',
  brandYoutube: '#FF0033',
};
