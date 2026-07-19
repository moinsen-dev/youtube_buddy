import { eq, isNull, notInArray } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import {
  channels,
  playlists,
  playlistItems,
  settings,
  subscriptions,
  videos,
} from '@/core/db/schema';
import type * as schema from '@/core/db/schema';

export type Db = ExpoSQLiteDatabase<typeof schema>;

// --- settings ---

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

// --- channels & subscriptions (M1) ---

export interface ChannelRow {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  updatedAt: number;
}

export async function upsertChannels(db: Db, rows: ChannelRow[]): Promise<void> {
  for (const row of rows) {
    await db.insert(channels).values(row).onConflictDoUpdate({ target: channels.id, set: row });
  }
}

export interface SubscriptionRow {
  channelId: string;
  subscribedAt: number;
  deletedAt: number | null;
}

export async function upsertSubscriptions(db: Db, rows: SubscriptionRow[]): Promise<void> {
  for (const row of rows) {
    await db
      .insert(subscriptions)
      .values(row)
      .onConflictDoUpdate({ target: subscriptions.channelId, set: row });
  }
}

/** Soft-deletes subscriptions that are no longer returned by the API. */
export async function markSubscriptionsDeleted(
  db: Db,
  activeChannelIds: string[],
  deletedAt: number,
): Promise<void> {
  if (activeChannelIds.length === 0) return;
  await db
    .update(subscriptions)
    .set({ deletedAt })
    .where(notInArray(subscriptions.channelId, activeChannelIds));
}

export interface SubscriptionListItem {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  subscribedAt: number;
}

export async function listActiveSubscriptions(db: Db): Promise<SubscriptionListItem[]> {
  const rows = await db
    .select({
      channelId: subscriptions.channelId,
      title: channels.title,
      thumbnailUrl: channels.thumbnailUrl,
      subscribedAt: subscriptions.subscribedAt,
    })
    .from(subscriptions)
    .innerJoin(channels, eq(subscriptions.channelId, channels.id))
    .where(isNull(subscriptions.deletedAt))
    .orderBy(channels.title);
  return rows;
}

// --- videos (M1) ---

export interface VideoRow {
  id: string;
  channelId: string;
  title: string;
  durationSec: number | null;
  publishedAt: number | null;
  thumbnailUrl: string | null;
  description: string | null;
  updatedAt: number;
}

export async function upsertVideos(db: Db, rows: VideoRow[]): Promise<void> {
  for (const row of rows) {
    await db.insert(videos).values(row).onConflictDoUpdate({ target: videos.id, set: row });
  }
}

// --- playlists (M1) ---

export interface PlaylistRow {
  id: string;
  title: string;
  itemCount: number;
  updatedAt: number;
}

export async function upsertPlaylists(db: Db, rows: PlaylistRow[]): Promise<void> {
  for (const row of rows) {
    await db.insert(playlists).values(row).onConflictDoUpdate({ target: playlists.id, set: row });
  }
}

export async function replacePlaylistItems(
  db: Db,
  playlistId: string,
  items: { videoId: string; position: number }[],
): Promise<void> {
  await db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId));
  for (const item of items) {
    await db.insert(playlistItems).values({ playlistId, ...item });
  }
}

/** Counts videos currently stored for a playlist (for list UIs). */
export async function listPlaylistVideoIds(db: Db, playlistId: string): Promise<string[]> {
  const rows = await db
    .select({ videoId: playlistItems.videoId })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position);
  return rows.map((row) => row.videoId);
}
