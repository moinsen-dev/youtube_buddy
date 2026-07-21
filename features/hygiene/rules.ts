import type { ChannelWatchStats } from '@/core/db/repositories';

/**
 * Unsubscribe suggestion rules (M9, DESIGN 5.10). Pure functions over the
 * Sehverhalten-Report — unit-tested, no DB or network.
 */

export type HygieneRule = 'no-views-90d' | 'low-quote' | 'dormant-6m';

export interface HygieneSuggestion {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  rule: HygieneRule;
  /** Display label, e.g. '0 Views/90 T', 'Quote 4 %', '💤 seit 6 Mo'. */
  reason: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const NO_VIEWS_WINDOW_MS = 90 * DAY_MS;
export const DORMANT_WINDOW_MS = 180 * DAY_MS;
export const LOW_QUOTE_THRESHOLD = 0.1;
/** Minimum sample size before the watch-quote rule fires. */
export const LOW_QUOTE_MIN_VIDEOS = 3;

const RULE_ORDER: Record<HygieneRule, number> = {
  'dormant-6m': 0,
  'no-views-90d': 1,
  'low-quote': 2,
};

/**
 * Applies the three rules (first match wins per channel, most severe first):
 * - dormant-6m: nothing watched in 180 days (never-watched counts from the
 *   subscription date)
 * - no-views-90d: nothing watched in 90 days
 * - low-quote: avg watch quote < 10 % over at least 3 watched videos
 */
export function suggestUnsubscribes(stats: ChannelWatchStats[], now: number): HygieneSuggestion[] {
  const suggestions: HygieneSuggestion[] = [];
  for (const channel of stats) {
    const lastActivity = channel.lastWatchedAt ?? channel.subscribedAt;
    const base = {
      channelId: channel.channelId,
      title: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
    };
    if (now - lastActivity >= DORMANT_WINDOW_MS) {
      suggestions.push({ ...base, rule: 'dormant-6m', reason: '💤 seit 6 Mo' });
    } else if (now - lastActivity >= NO_VIEWS_WINDOW_MS) {
      suggestions.push({ ...base, rule: 'no-views-90d', reason: '0 Views/90 T' });
    } else if (
      channel.watchedVideos >= LOW_QUOTE_MIN_VIDEOS &&
      (channel.avgPercentWatched ?? 1) < LOW_QUOTE_THRESHOLD
    ) {
      const pct = Math.round((channel.avgPercentWatched ?? 0) * 100);
      suggestions.push({ ...base, rule: 'low-quote', reason: `Quote ${pct} %` });
    }
  }
  return suggestions.sort(
    (a, b) => RULE_ORDER[a.rule] - RULE_ORDER[b.rule] || a.title.localeCompare(b.title),
  );
}

/** "Am meisten geschaut" list (DESIGN 5.10): most watched channels first. */
export function mostWatched(stats: ChannelWatchStats[], limit = 10): ChannelWatchStats[] {
  return [...stats]
    .filter((channel) => channel.watchedVideos > 0)
    .sort((a, b) => b.watchedVideos - a.watchedVideos)
    .slice(0, limit);
}
