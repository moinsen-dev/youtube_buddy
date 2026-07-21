import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  index,
  unique,
  blob,
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
  /** YouTube subscription resource id (needed for subscriptions.delete, M9). */
  youtubeSubId: text('youtube_sub_id'),
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

// --- M6: Wissensmodule (ARCHITECTURE.md §4) ---

export type NoteType =
  'summary' | 'guide' | 'flashcard_set' | 'habit' | 'trip' | 'concept' | 'free';

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  videoId: text('video_id').references(() => videos.id),
  /** references concepts(id) — table lands with M11 in phase 7. */
  conceptId: integer('concept_id'),
  type: text('type').$type<NoteType>().notNull(),
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  /** Stable cross-device id for Pro-Sync (trigger-filled, M9.5). */
  syncId: text('sync_id'),
});

export const flashcards = sqliteTable(
  'flashcards',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    noteId: integer('note_id').references(() => notes.id),
    front: text('front').notNull(),
    back: text('back').notNull(),
    sourceSec: integer('source_sec'),
    ease: real('ease').notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    dueAt: integer('due_at').notNull(),
    reps: integer('reps').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    /** LWW timestamp for Pro-Sync (M9.5) — set on every SRS update. */
    updatedAt: integer('updated_at').notNull().default(0),
    /** Stable cross-device id for Pro-Sync (trigger-filled, M9.5). */
    syncId: text('sync_id'),
  },
  (table) => [index('idx_flashcards_due').on(table.dueAt)],
);

export const flashcardReviews = sqliteTable('flashcard_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardId: integer('card_id')
    .notNull()
    .references(() => flashcards.id),
  reviewedAt: integer('reviewed_at').notNull(),
  /** SM-2 grade 0–5. */
  grade: integer('grade').notNull(),
});

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id),
  noteId: integer('note_id').references(() => notes.id),
  title: text('title').notNull(),
  cue: text('cue'),
  active: integer('active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
});

export const habitChecks = sqliteTable(
  'habit_checks',
  {
    habitId: integer('habit_id')
      .notNull()
      .references(() => habits.id),
    /** ISO day 'YYYY-MM-DD' (local). */
    day: text('day').notNull(),
    done: integer('done').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.habitId, table.day] })],
);

export const guides = sqliteTable('guides', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id),
  noteId: integer('note_id').references(() => notes.id),
  title: text('title').notNull(),
  /** JSON payload: steps + materials (zod-validated before write). */
  payload: text('payload').notNull(),
  progressStep: integer('progress_step').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// --- M11: Wissensbasis (ARCHITECTURE.md §4) ---

export const concepts = sqliteTable('concepts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Normalized lookup key (lowercase, singular). */
  name: text('name').unique().notNull(),
  displayName: text('display_name').notNull(),
  noteId: integer('note_id').references(() => notes.id),
  createdAt: integer('created_at').notNull(),
});

export const noteLinks = sqliteTable(
  'note_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    srcNoteId: integer('src_note_id')
      .notNull()
      .references(() => notes.id),
    dstNoteId: integer('dst_note_id').references(() => notes.id),
    /** Link target as written in the body (kept for unresolved links). */
    dstConceptName: text('dst_concept_name').notNull(),
    /** 1 = resolved to dst_note_id, 0 = unresolved (Obsidian-style). */
    resolved: integer('resolved').notNull().default(0),
  },
  (table) => [
    index('idx_note_links_src').on(table.srcNoteId),
    index('idx_note_links_dst').on(table.dstNoteId),
  ],
);

// --- M7: Reise-Modul (ARCHITECTURE.md §4) ---

export const trips = sqliteTable('trips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  noteId: integer('note_id').references(() => notes.id),
  createdAt: integer('created_at').notNull(),
});

export type GeocodeStatus = 'pending' | 'ok' | 'manual' | 'failed';

export const tripPlaces = sqliteTable(
  'trip_places',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    name: text('name').notNull(),
    lat: real('lat'),
    lon: real('lon'),
    sourceSec: integer('source_sec'),
    position: integer('position').notNull(),
    geocodeStatus: text('geocode_status').$type<GeocodeStatus>().notNull().default('pending'),
  },
  (table) => [index('idx_trip_places_trip').on(table.tripId, table.position)],
);

// --- M8: Semantische Suche (ARCHITECTURE.md §4) ---

export type EmbeddingOwnerType = 'transcript_chunk' | 'note' | 'concept' | 'analysis';

export const embeddings = sqliteTable(
  'embeddings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ownerType: text('owner_type').$type<EmbeddingOwnerType>().notNull(),
    ownerId: integer('owner_id').notNull(),
    /** Float32Array as raw bytes (384 dims, paraphrase-multilingual-MiniLM-L12-v2). */
    vector: blob('vector').notNull(),
    model: text('model').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_embeddings_owner').on(table.ownerType, table.ownerId),
    unique('uq_embeddings_owner_model').on(table.ownerType, table.ownerId, table.model),
  ],
);
