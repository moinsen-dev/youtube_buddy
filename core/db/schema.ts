import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  index,
  unique,
} from 'drizzle-orm/sqlite-core';

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

// --- M2: Player & Watch-Tracking (ARCHITECTURE.md §4) ---
export const watchSessions = sqliteTable(
  'watch_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    positionSec: integer('position_sec').notNull().default(0),
    percentWatched: real('percent_watched').notNull().default(0),
    /** 'player' | 'manual' | 'takeout' */
    source: text('source').notNull().default('player'),
  },
  (table) => [index('idx_watch_sessions_video_started').on(table.videoId, table.startedAt)],
);

// --- M3: Transkripte (ARCHITECTURE.md §4) ---

export const transcripts = sqliteTable('transcripts', {
  videoId: text('video_id')
    .primaryKey()
    .references(() => videos.id),
  lang: text('lang'),
  /** 'captions' | 'whisper' (whisper = späterer Fallback) */
  source: text('source'),
  fetchedAt: integer('fetched_at').notNull(),
});

export const transcriptChunks = sqliteTable(
  'transcript_chunks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    idx: integer('idx').notNull(),
    startSec: real('start_sec').notNull(),
    endSec: real('end_sec').notNull(),
    text: text('text').notNull(),
    embeddingId: integer('embedding_id'),
  },
  (table) => [index('idx_transcript_chunks_video_idx').on(table.videoId, table.idx)],
);

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

// --- M5: Video-Analyse (ARCHITECTURE.md §4) ---

export type AnalysisKind = 'summary' | 'chapters' | 'triage';

export const analyses = sqliteTable(
  'analyses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    /** 'summary' | 'chapters' | 'triage' */
    kind: text('kind').$type<AnalysisKind>().notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    /** JSON payload (zod-validated before write). */
    payload: text('payload').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_analyses_video_kind').on(table.videoId, table.kind),
    unique('uq_analyses_video_kind').on(table.videoId, table.kind),
  ],
);
