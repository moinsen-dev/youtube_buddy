import { shouldSync, SUBSCRIPTIONS_TTL_MS, VIDEOS_TTL_MS } from './sync';

describe('core/youtube sync TTL (cache-first, ARCHITECTURE §6)', () => {
  const now = Date.parse('2026-07-19T12:00:00Z');

  it('syncs when there is no previous sync', () => {
    expect(shouldSync(null, SUBSCRIPTIONS_TTL_MS, now)).toBe(true);
  });

  it('skips when the last sync is still fresh', () => {
    const oneHourAgo = now - 60 * 60 * 1000;
    expect(shouldSync(oneHourAgo, SUBSCRIPTIONS_TTL_MS, now)).toBe(false);
  });

  it('syncs exactly at the TTL boundary', () => {
    const sixHoursAgo = now - SUBSCRIPTIONS_TTL_MS;
    expect(shouldSync(sixHoursAgo, SUBSCRIPTIONS_TTL_MS, now)).toBe(true);
  });

  it('uses 24 h TTL for videos and 6 h for subscriptions', () => {
    expect(SUBSCRIPTIONS_TTL_MS).toBe(6 * 60 * 60 * 1000);
    expect(VIDEOS_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
