import {
  getSubscriptionSubId,
  markSubscriptionDeleted,
  setSetting,
  type Db,
} from '@/core/db/repositories';
import type { YouTubeClient } from '@/core/youtube/client';
import { subscriptionListSchema } from '@/core/youtube/dto';
import { QuotaBlockedError } from '@/core/youtube/quota';

/**
 * Batch unsubscribe (M9, ROADMAP phase 10): subscriptions.delete per channel
 * (50 units each) with a local soft-delete after every success. The caller
 * (screen) handles the incremental youtube.force-ssl consent beforehand.
 */

export interface UnsubscribeResult {
  done: number;
  failed: { channelId: string; reason: string }[];
}

/**
 * Resolves the YouTube subscription resource id for a channel: local row
 * first, otherwise one subscriptions.list lookup (1 unit) — rows written
 * before migration 0010 have no stored id yet.
 */
export async function resolveSubscriptionId(
  client: YouTubeClient,
  db: Db,
  channelId: string,
): Promise<string | null> {
  const stored = await getSubscriptionSubId(db, channelId);
  if (stored) return stored;
  const response = await client.get(
    'subscriptions.list',
    { part: 'snippet', mine: 'true', channelId, maxResults: '1' },
    subscriptionListSchema,
  );
  return response.items[0]?.id ?? null;
}

export async function unsubscribeChannels(
  client: YouTubeClient,
  db: Db,
  channelIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<UnsubscribeResult> {
  const result: UnsubscribeResult = { done: 0, failed: [] };
  for (const channelId of channelIds) {
    try {
      const subId = await resolveSubscriptionId(client, db, channelId);
      if (!subId) {
        result.failed.push({ channelId, reason: 'Subscription nicht gefunden' });
        continue;
      }
      await client.delete('subscriptions.delete', { id: subId });
      await markSubscriptionDeleted(db, channelId, Date.now());
      result.done += 1;
    } catch (cause) {
      if (cause instanceof QuotaBlockedError) {
        result.failed.push({ channelId, reason: 'Tages-Quota erschöpft' });
        break; // no point trying the rest today
      }
      result.failed.push({
        channelId,
        reason: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      onProgress?.(result.done + result.failed.length, channelIds.length);
    }
  }
  // Force the next library sync past its TTL so the list reflects reality.
  await setSetting(db, 'last_sync.subscriptions', '0');
  return result;
}
