import type { ChannelWatchStats } from '@/core/db/repositories';

import { LOW_QUOTE_MIN_VIDEOS, mostWatched, suggestUnsubscribes } from './rules';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function stats(partial: Partial<ChannelWatchStats>): ChannelWatchStats {
  return {
    channelId: 'UCx',
    title: 'Kanal',
    thumbnailUrl: null,
    subscribedAt: NOW - 400 * DAY,
    watchedVideos: 0,
    avgPercentWatched: null,
    lastWatchedAt: null,
    ...partial,
  };
}

describe('suggestUnsubscribes', () => {
  it('suggests dormant-6m when nothing watched in 180 days', () => {
    const result = suggestUnsubscribes([stats({ lastWatchedAt: NOW - 200 * DAY })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe('dormant-6m');
    expect(result[0].reason).toBe('💤 seit 6 Mo');
  });

  it('counts never-watched channels from their subscription date', () => {
    const old = suggestUnsubscribes([stats({ subscribedAt: NOW - 400 * DAY })], NOW);
    expect(old[0]?.rule).toBe('dormant-6m');
    const fresh = suggestUnsubscribes([stats({ subscribedAt: NOW - 10 * DAY })], NOW);
    expect(fresh).toHaveLength(0);
  });

  it('suggests no-views-90d between 90 and 180 days of inactivity', () => {
    const result = suggestUnsubscribes([stats({ lastWatchedAt: NOW - 100 * DAY })], NOW);
    expect(result[0]?.rule).toBe('no-views-90d');
    expect(result[0]?.reason).toBe('0 Views/90 T');
  });

  it('suggests low-quote only with enough sample videos', () => {
    const thin = suggestUnsubscribes(
      [
        stats({
          watchedVideos: LOW_QUOTE_MIN_VIDEOS - 1,
          avgPercentWatched: 0.05,
          lastWatchedAt: NOW - DAY,
        }),
      ],
      NOW,
    );
    expect(thin).toHaveLength(0);
    const enough = suggestUnsubscribes(
      [
        stats({
          watchedVideos: LOW_QUOTE_MIN_VIDEOS,
          avgPercentWatched: 0.04,
          lastWatchedAt: NOW - DAY,
        }),
      ],
      NOW,
    );
    expect(enough[0]?.rule).toBe('low-quote');
    expect(enough[0]?.reason).toBe('Quote 4 %');
  });

  it('does not suggest healthy channels', () => {
    const result = suggestUnsubscribes(
      [stats({ watchedVideos: 10, avgPercentWatched: 0.8, lastWatchedAt: NOW - DAY })],
      NOW,
    );
    expect(result).toHaveLength(0);
  });

  it('sorts by rule severity: dormant first', () => {
    const result = suggestUnsubscribes(
      [
        stats({
          channelId: 'a',
          title: 'B-Kanal',
          watchedVideos: 5,
          avgPercentWatched: 0.05,
          lastWatchedAt: NOW - DAY,
        }),
        stats({ channelId: 'b', title: 'A-Kanal', lastWatchedAt: NOW - 300 * DAY }),
      ],
      NOW,
    );
    expect(result.map((s) => s.rule)).toEqual(['dormant-6m', 'low-quote']);
  });
});

describe('mostWatched', () => {
  it('ranks by watched videos and skips never-watched channels', () => {
    const result = mostWatched([
      stats({ channelId: 'a', watchedVideos: 2 }),
      stats({ channelId: 'b', watchedVideos: 0 }),
      stats({ channelId: 'c', watchedVideos: 9 }),
    ]);
    expect(result.map((c) => c.channelId)).toEqual(['c', 'a']);
  });
});
