import { darkColors, getTheme, lightColors, spacing, typography } from './index';

describe('core/theme (DESIGN.md §2)', () => {
  it('defines all dark tokens with the exact spec values', () => {
    expect(darkColors).toMatchObject({
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
    });
  });

  it('defines the light variant with the same token structure', () => {
    expect(Object.keys(lightColors)).toEqual(Object.keys(darkColors));
    expect(lightColors.bgBase).toBe('#FAFAFC');
    expect(lightColors.textPrimary).toBe('#101828');
    // Accent is identical across themes (DESIGN §2.1).
    expect(lightColors.accentPrimary).toBe(darkColors.accentPrimary);
  });

  it('is dark-first', () => {
    expect(getTheme('dark').dark).toBe(true);
    expect(getTheme('dark').colors).toBe(darkColors);
    expect(getTheme('light').colors).toBe(lightColors);
  });

  it('keeps the 4-pt spacing grid in ascending order', () => {
    const values = Object.values(spacing);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values.every((v) => v % 4 === 0)).toBe(true);
  });

  it('defines all typography styles with size, line height and weight', () => {
    for (const style of Object.values(typography)) {
      expect(style.fontSize).toBeGreaterThan(0);
      expect(style.lineHeight).toBeGreaterThan(style.fontSize);
      expect(['400', '600', '700']).toContain(style.fontWeight);
    }
    expect(typography.step.fontSize).toBe(28); // guide mode, DESIGN §2.2
  });
});
