/**
 * YouTube Data API quota budget (ARCHITECTURE.md §6, AGENTS.md quota rule).
 * Every API call declares its unit cost; usage is tracked per day in the
 * quota_log table. The pure decision logic lives here and is unit-tested;
 * the SQLite-backed store lives in quota-store.ts.
 */

export const QUOTA_DAILY_LIMIT = 10_000;
export const QUOTA_WARN_RATIO = 0.8;

/** Unit costs per YouTube Data API endpoint (official pricing). search.list
 * is intentionally absent — it is banned by project rule (100 units/call). */
export const UNIT_COSTS = {
  'subscriptions.list': 1,
  'channels.list': 1,
  'playlists.list': 1,
  'playlistItems.list': 1,
  'videos.list': 1,
} as const;

export type YouTubeEndpoint = keyof typeof UNIT_COSTS;

export type QuotaDecision = 'allow' | 'warn' | 'block';

/** Day key (YYYY-MM-DD, UTC) used as primary key in quota_log. */
export function quotaDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Decides whether a call costing `cost` units may run.
 * - 'block' when it would exceed the daily limit (caller must serve cache)
 * - 'warn' when it pushes usage past 80 % of the limit (UI shows QuotaMeter)
 * - 'allow' otherwise
 */
export function decideQuota(
  usedToday: number,
  cost: number,
  limit: number = QUOTA_DAILY_LIMIT,
): QuotaDecision {
  if (usedToday + cost > limit) return 'block';
  if ((usedToday + cost) / limit > QUOTA_WARN_RATIO) return 'warn';
  return 'allow';
}

export interface QuotaStore {
  getUnitsUsed(day: string): Promise<number>;
  addUnits(day: string, units: number): Promise<number>;
}

/**
 * Checks quota before a call and records it after a successful one.
 * Throws QuotaBlockedError when the budget is exhausted.
 */
export async function guardQuota(
  store: QuotaStore,
  endpoint: YouTubeEndpoint,
  options: { day?: string; onWarn?: (usedToday: number) => void } = {},
): Promise<void> {
  const day = options.day ?? quotaDayKey();
  const cost = UNIT_COSTS[endpoint];
  const usedToday = await store.getUnitsUsed(day);
  const decision = decideQuota(usedToday, cost);
  if (decision === 'block') {
    throw new QuotaBlockedError(day, usedToday, cost);
  }
  if (decision === 'warn') {
    options.onWarn?.(usedToday + cost);
  }
  await store.addUnits(day, cost);
}

export class QuotaBlockedError extends Error {
  readonly day: string;
  readonly usedToday: number;
  readonly cost: number;

  constructor(day: string, usedToday: number, cost: number) {
    super(`YouTube quota exhausted for ${day}: ${usedToday} used, call costs ${cost}`);
    this.name = 'QuotaBlockedError';
    this.day = day;
    this.usedToday = usedToday;
    this.cost = cost;
  }
}
