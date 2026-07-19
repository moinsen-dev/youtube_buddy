import { breakpoints, resolveBreakpoint } from './index';

describe('core/platform breakpoints (DESIGN.md §3)', () => {
  it('maps widths to phone / tablet / web', () => {
    expect(resolveBreakpoint(375)).toBe('phone');
    expect(resolveBreakpoint(599)).toBe('phone');
    expect(resolveBreakpoint(600)).toBe('tablet');
    expect(resolveBreakpoint(1024)).toBe('tablet');
    expect(resolveBreakpoint(1025)).toBe('web');
    expect(resolveBreakpoint(1920)).toBe('web');
  });

  it('matches the documented cutoffs', () => {
    expect(breakpoints.tablet).toBe(600);
    expect(breakpoints.web).toBe(1024);
  });
});
