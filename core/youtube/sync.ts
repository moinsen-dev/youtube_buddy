import {
  getSetting,
  listPlaylistVideoIds,
  markSubscriptionsDeleted,
  replacePlaylistItems,
  setSetting,
  upsertChannels,
  upsertPlaylists,
  upsertSubscriptions,
  upsertVideos,
  type ChannelRow,
  type Db,
  type SubscriptionRow,
  type VideoRow,
} from '@/core/db/repositories';

import type { YouTubeClient } from './client';
import {
  bestThumbnail,
  channelListSchema,
  parseIsoDate,
  parseIsoDuration,
  playlistItemListSchema,
  playlistListSchema,
  subscriptionListSchema,
  videoListSchema,
} from './dto';

/**
 * Sync jobs for M1 (ARCHITECTURE §6): cache-first with TTLs, every network
 * call goes through YouTubeClient (quota accounting + ETag).
 */

export const SUBSCRIPTIONS_TTL_MS = 6 * 60 * 60 * 1000; // 6 h
export const VIDEOS_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_PAGES = 10; // 500 items per resource is plenty for v1

const PART_SNIPPET = 'snippet';

/** Pure TTL decision, unit-tested. */
export function shouldSync(lastSyncAt: number | null, ttlMs: number, now: number): boolean {
  if (lastSyncAt === null) return true;
  return now - lastSyncAt >= ttlMs;
}

export interface SyncResult {
  synced: boolean;
  reason: 'fresh' | 'ok';
  items: number;
}

function lastSyncKey(resource: string): string {
  return `last_sync.${resource}`;
}

async function readLastSync(db: Db, resource: string): Promise<number | null> {
  const raw = await getSetting(db, lastSyncKey(resource));
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

async function writeLastSync(db: Db, resource: string, now: number): Promise<void> {
  await setSetting(db, lastSyncKey(resource), String(now));
}

/** subscriptions.list (mine) → channels + subscriptions, soft-delete stale. */
export async function syncSubscriptions(
  client: YouTubeClient,
  db: Db,
  options: { now?: number; force?: boolean } = {},
): Promise<SyncResult> {
  const now = options.now ?? Date.now();
  if (
    !options.force &&
    !shouldSync(await readLastSync(db, 'subscriptions'), SUBSCRIPTIONS_TTL_MS, now)
  ) {
    return { synced: false, reason: 'fresh', items: 0 };
  }

  const channelRows: ChannelRow[] = [];
  const subscriptionRows: SubscriptionRow[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await client.get(
      'subscriptions.list',
      {
        part: PART_SNIPPET,
        mine: 'true',
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      },
      subscriptionListSchema,
    );
    for (const item of response.items) {
      const channelId = item.snippet.resourceId.channelId;
      channelRows.push({
        id: channelId,
        title: item.snippet.title,
        thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
        subscriberCount: null,
        updatedAt: now,
      });
      subscriptionRows.push({
        channelId,
        subscribedAt: parseIsoDate(item.snippet.publishedAt) ?? now,
        deletedAt: null,
        youtubeSubId: item.id,
      });
    }
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  await upsertChannels(db, channelRows);
  await upsertSubscriptions(db, subscriptionRows);
  await markSubscriptionsDeleted(
    db,
    subscriptionRows.map((row) => row.channelId),
    now,
  );
  await writeLastSync(db, 'subscriptions', now);
  return { synced: true, reason: 'ok', items: subscriptionRows.length };
}

/** playlists.list (mine) → playlists. */
export async function syncMyPlaylists(
  client: YouTubeClient,
  db: Db,
  options: { now?: number; force?: boolean } = {},
): Promise<SyncResult> {
  const now = options.now ?? Date.now();
  if (!options.force && !shouldSync(await readLastSync(db, 'playlists'), VIDEOS_TTL_MS, now)) {
    return { synced: false, reason: 'fresh', items: 0 };
  }

  let count = 0;
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await client.get(
      'playlists.list',
      { part: PART_SNIPPET, mine: 'true', maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      playlistListSchema,
    );
    await upsertPlaylists(
      db,
      response.items.map((item) => ({
        id: item.id,
        title: item.snippet?.title ?? '',
        itemCount: item.contentDetails?.itemCount ?? 0,
        updatedAt: now,
      })),
    );
    count += response.items.length;
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  await writeLastSync(db, 'playlists', now);
  return { synced: true, reason: 'ok', items: count };
}

/**
 * Watch Later (and Likes as fallback target): channels.list(mine) →
 * relatedPlaylists, playlistItems.list, videos.list batch (50 ids/call).
 */
export async function syncWatchLater(
  client: YouTubeClient,
  db: Db,
  options: { now?: number; force?: boolean; playlistId?: string } = {},
): Promise<SyncResult> {
  const now = options.now ?? Date.now();
  if (!options.force && !shouldSync(await readLastSync(db, 'watch_later'), VIDEOS_TTL_MS, now)) {
    return { synced: false, reason: 'fresh', items: 0 };
  }

  let playlistId = options.playlistId ?? null;
  if (!playlistId) {
    const mine = await client.get(
      'channels.list',
      { part: 'contentDetails', mine: 'true' },
      channelListSchema,
    );
    playlistId = mine.items[0]?.contentDetails?.relatedPlaylists?.watchLater ?? null;
  }
  // Viewer accounts (no creator channel): channels.list(mine) comes back
  // empty, so relatedPlaylists.watchLater never arrives. playlistItems.list
  // accepts the literal "WL" alias for the authorized user's Watch Later
  // playlist (verified against the Data API in phase 5).
  playlistId ??= 'WL';
  if (!playlistId) {
    return { synced: false, reason: 'ok', items: 0 };
  }

  const videoIds: { videoId: string; position: number }[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await client.get(
      'playlistItems.list',
      { part: PART_SNIPPET, playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      playlistItemListSchema,
    );
    for (const item of response.items) {
      const videoId = item.snippet?.resourceId.videoId ?? item.contentDetails?.videoId;
      const position = item.snippet?.position;
      if (videoId && position !== undefined) {
        videoIds.push({ videoId, position });
      }
    }
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  // Fetch full metadata in batches of 50 ids (ARCHITECTURE §6 batching rule).
  const videoRows: VideoRow[] = [];
  for (let offset = 0; offset < videoIds.length; offset += 50) {
    const batch = videoIds.slice(offset, offset + 50);
    const response = await client.get(
      'videos.list',
      { part: `${PART_SNIPPET},contentDetails`, id: batch.map((v) => v.videoId).join(',') },
      videoListSchema,
    );
    for (const item of response.items) {
      videoRows.push({
        id: item.id,
        channelId: item.snippet?.channelId ?? '',
        title: item.snippet?.title ?? '',
        durationSec: parseIsoDuration(item.contentDetails?.duration),
        publishedAt: parseIsoDate(item.snippet?.publishedAt),
        thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
        description: item.snippet?.description ?? null,
        updatedAt: now,
      });
    }
  }

  await upsertVideos(db, videoRows);
  await replacePlaylistItems(db, playlistId, videoIds);
  await setSetting(db, 'watch_later.playlist_id', playlistId);
  await writeLastSync(db, 'watch_later', now);
  return { synced: true, reason: 'ok', items: (await listPlaylistVideoIds(db, playlistId)).length };
}
