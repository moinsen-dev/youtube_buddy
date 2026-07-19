import { eq, isNull, notInArray, desc } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import {
  channels,
  playlists,
  playlistItems,
  settings,
  subscriptions,
  videos,
  watchSessions,
} from '@/core/db/schema';
import type * as schema from '@/core/db/schema';

// --- watch_sessions (M2) ---

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

// --- videos (M1/M2 helpers) ---

export interface VideoListItem {
  id: string;
  title: string;
  channelId: string;
  durationSec: number | null;
  thumbnailUrl: string | null;
}

export async function getVideo(db: Db, id: string): Promise<VideoListItem | null> {
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      channelId: videos.channelId,
      durationSec: videos.durationSec,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(videos)
    .where(eq(videos.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Videos of a playlist with metadata (e.g. Watch Later rail on Home). */
export async function listPlaylistVideos(
  db: Db,
  playlistId: string,
  limit = 50,
): Promise<VideoListItem[]> {
  return db
    .select({
      id: videos.id,
      title: videos.title,
      channelId: videos.channelId,
      durationSec: videos.durationSec,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position)
    .limit(limit);
}

export interface WatchSessionRow {
  id: number;
  videoId: string;
  startedAt: number;
  endedAt: number | null;
  positionSec: number;
  percentWatched: number;
  source: string;
}

export async function insertWatchSession(
  db: Db,
  row: Omit<WatchSessionRow, 'id'>,
): Promise<number> {
  const result = await db.insert(watchSessions).values(row);
  return Number(result.lastInsertRowId);
}

export async function updateWatchSession(
  db: Db,
  id: number,
  patch: Partial<Omit<WatchSessionRow, 'id' | 'videoId'>>,
): Promise<void> {
  await db.update(watchSessions).set(patch).where(eq(watchSessions.id, id));
}

/** Latest session for a video — used for resume-on-reopen. */
export async function getLatestSessionForVideo(
  db: Db,
  videoId: string,
): Promise<WatchSessionRow | null> {
  const rows = await db
    .select()
    .from(watchSessions)
    .where(eq(watchSessions.videoId, videoId))
    .orderBy(desc(watchSessions.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface SessionWithVideo {
  session: WatchSessionRow;
  video: VideoListItem;
}

async function latestSessionsWithVideo(db: Db): Promise<SessionWithVideo[]> {
  const rows = await db
    .select()
    .from(watchSessions)
    .innerJoin(videos, eq(watchSessions.videoId, videos.id))
    .orderBy(desc(watchSessions.startedAt));
  const byVideo = new Map<string, SessionWithVideo>();
  for (const row of rows) {
    if (byVideo.has(row.watch_sessions.videoId)) continue;
    byVideo.set(row.watch_sessions.videoId, {
      session: row.watch_sessions,
      video: {
        id: row.videos.id,
        title: row.videos.title,
        channelId: row.videos.channelId,
        durationSec: row.videos.durationSec,
        thumbnailUrl: row.videos.thumbnailUrl,
      },
    });
  }
  return [...byVideo.values()];
}

/** "Weiterschauen" rail: open sessions below the watched threshold. */
export async function listOpenSessions(db: Db): Promise<SessionWithVideo[]> {
  const all = await latestSessionsWithVideo(db);
  return all.filter((row) => row.session.percentWatched < 0.8 && row.session.source !== 'manual');
}

/** Verlauf tab: latest session per video, newest first. */
export async function listHistory(db: Db): Promise<SessionWithVideo[]> {
  return latestSessionsWithVideo(db);
}

/** Manual "als geschaut markieren" — a full-percent row with source 'manual'. */
export async function markVideoWatched(db: Db, videoId: string, now: number): Promise<void> {
  await insertWatchSession(db, {
    videoId,
    startedAt: now,
    endedAt: now,
    positionSec: 0,
    percentWatched: 1,
    source: 'manual',
  });
}
