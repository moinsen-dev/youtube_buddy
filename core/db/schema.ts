import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Initial schema — cross-cutting tables only (ARCHITECTURE.md §4,
 * "M9/Querschnitt"). Feature tables arrive with their phases (M1 in phase 1,
 * M2 in phase 2, …) as additional migrations.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const quotaLog = sqliteTable('quota_log', {
  day: text('day').primaryKey(),
  unitsUsed: integer('units_used').notNull().default(0),
});

// --- M1: Auth & YouTube-Read (ARCHITECTURE.md §4) ---

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  subscriberCount: integer('subscriber_count'),
  updatedAt: integer('updated_at').notNull(),
});

export const subscriptions = sqliteTable('subscriptions', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  subscribedAt: integer('subscribed_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id),
  title: text('title').notNull(),
  durationSec: integer('duration_sec'),
  publishedAt: integer('published_at'),
  thumbnailUrl: text('thumbnail_url'),
  description: text('description'),
  updatedAt: integer('updated_at').notNull(),
});

export const playlists = sqliteTable('playlists', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  itemCount: integer('item_count').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

export const playlistItems = sqliteTable(
  'playlist_items',
  {
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    position: integer('position').notNull(),
  },
  (table) => [primaryKey({ columns: [table.playlistId, table.videoId] })],
);
