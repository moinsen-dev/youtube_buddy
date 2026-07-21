import { sql } from 'drizzle-orm';

import type { EntityAdapter } from './sync-engine';

/**
 * Entity adapters for Pro-Sync (ADR PRD §7.6). FK references are naturalized
 * into payloads (videos/channels use YouTube ids, concepts their unique
 * name, notes/flashcards their sync_id) and resolved back to local
 * autoincrement ids on import. FK-safe order: channels → videos → concepts →
 * notes → analyses → flashcards.
 *
 * v1 exclusions (documented ADR details): transcripts/chunks, embeddings,
 * models, quota_log, watch_sessions, concept.noteId back-reference, deletes
 * (no tombstones).
 */

interface ChannelRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  updated_at: number;
}

interface VideoRow {
  id: string;
  channel_id: string;
  title: string;
  duration_sec: number | null;
  published_at: number | null;
  thumbnail_url: string | null;
  description: string | null;
  updated_at: number;
}

interface ConceptRow {
  id: number;
  name: string;
  display_name: string;
  created_at: number;
}

interface NoteRow {
  id: number;
  sync_id: string;
  video_id: string | null;
  concept_name: string | null;
  type: string;
  title: string;
  body_md: string;
  created_at: number;
  updated_at: number;
}

interface AnalysisRow {
  video_id: string;
  kind: string;
  model: string;
  prompt_version: string;
  payload: string;
  created_at: number;
}

interface FlashcardRow {
  id: number;
  sync_id: string;
  video_id: string;
  note_sync_id: string | null;
  front: string;
  back: string;
  source_sec: number | null;
  ease: number;
  interval_days: number;
  due_at: number;
  reps: number;
  created_at: number;
  updated_at: number;
}

export const channelsAdapter: EntityAdapter<ChannelRow> = {
  kind: 'channels',
  listLocal: async (db) => db.all<ChannelRow>(sql`SELECT * FROM channels`),
  entityId: (row) => row.id,
  updatedAt: (row) => row.updated_at,
  toPayload: (row) => row,
  upsertLocal: async (db, payload) => {
    const row = payload as ChannelRow;
    await db.run(
      sql`INSERT INTO channels (id, title, thumbnail_url, subscriber_count, updated_at)
          VALUES (${row.id}, ${row.title}, ${row.thumbnail_url}, ${row.subscriber_count}, ${row.updated_at})
          ON CONFLICT (id) DO UPDATE SET title = excluded.title, thumbnail_url = excluded.thumbnail_url,
            subscriber_count = excluded.subscriber_count, updated_at = excluded.updated_at`,
    );
  },
};

export const videosAdapter: EntityAdapter<VideoRow> = {
  kind: 'videos',
  listLocal: async (db) => db.all<VideoRow>(sql`SELECT * FROM videos`),
  entityId: (row) => row.id,
  updatedAt: (row) => row.updated_at,
  toPayload: (row) => row,
  upsertLocal: async (db, payload) => {
    const row = payload as VideoRow;
    await db.run(
      sql`INSERT INTO videos (id, channel_id, title, duration_sec, published_at, thumbnail_url, description, updated_at)
          VALUES (${row.id}, ${row.channel_id}, ${row.title}, ${row.duration_sec}, ${row.published_at}, ${row.thumbnail_url}, ${row.description}, ${row.updated_at})
          ON CONFLICT (id) DO UPDATE SET title = excluded.title, duration_sec = excluded.duration_sec,
            published_at = excluded.published_at, thumbnail_url = excluded.thumbnail_url,
            description = excluded.description, updated_at = excluded.updated_at`,
    );
  },
};

export const conceptsAdapter: EntityAdapter<ConceptRow> = {
  kind: 'concepts',
  listLocal: async (db) => db.all<ConceptRow>(sql`SELECT * FROM concepts`),
  entityId: (row) => row.name,
  updatedAt: (row) => row.created_at,
  toPayload: (row) => ({
    name: row.name,
    displayName: row.display_name,
    createdAt: row.created_at,
  }),
  upsertLocal: async (db, payload) => {
    const row = payload as { name: string; displayName: string; createdAt: number };
    // noteId back-reference intentionally not synced (v1 ADR detail).
    await db.run(
      sql`INSERT INTO concepts (name, display_name, note_id, created_at)
          VALUES (${row.name}, ${row.displayName}, NULL, ${row.createdAt})
          ON CONFLICT (name) DO UPDATE SET display_name = excluded.display_name`,
    );
  },
};

export const notesAdapter: EntityAdapter<NoteRow> = {
  kind: 'notes',
  listLocal: async (db) =>
    db.all<NoteRow>(
      sql`SELECT n.id, n.sync_id, n.video_id, c.name AS concept_name, n.type, n.title,
                 n.body_md, n.created_at, n.updated_at
          FROM notes n LEFT JOIN concepts c ON c.id = n.concept_id`,
    ),
  entityId: (row) => row.sync_id,
  updatedAt: (row) => row.updated_at,
  toPayload: (row) => row,
  upsertLocal: async (db, payload) => {
    const row = payload as NoteRow;
    await db.run(
      sql`INSERT INTO notes (sync_id, video_id, concept_id, type, title, body_md, created_at, updated_at)
          VALUES (${row.sync_id}, ${row.video_id},
                  (SELECT id FROM concepts WHERE name = ${row.concept_name}),
                  ${row.type}, ${row.title}, ${row.body_md}, ${row.created_at}, ${row.updated_at})
          ON CONFLICT (sync_id) DO UPDATE SET video_id = excluded.video_id,
            concept_id = excluded.concept_id, type = excluded.type, title = excluded.title,
            body_md = excluded.body_md, updated_at = excluded.updated_at`,
    );
  },
};

export const analysesAdapter: EntityAdapter<AnalysisRow> = {
  kind: 'analyses',
  listLocal: async (db) => db.all<AnalysisRow>(sql`SELECT * FROM analyses`),
  entityId: (row) => `${row.video_id}:${row.kind}`,
  updatedAt: (row) => row.created_at, // analyses are immutable per (video, kind)
  toPayload: (row) => row,
  upsertLocal: async (db, payload) => {
    const row = payload as AnalysisRow;
    await db.run(
      sql`INSERT INTO analyses (video_id, kind, model, prompt_version, payload, created_at)
          VALUES (${row.video_id}, ${row.kind}, ${row.model}, ${row.prompt_version}, ${row.payload}, ${row.created_at})
          ON CONFLICT (video_id, kind) DO UPDATE SET model = excluded.model,
            prompt_version = excluded.prompt_version, payload = excluded.payload`,
    );
  },
};

export const flashcardsAdapter: EntityAdapter<FlashcardRow> = {
  kind: 'flashcards',
  listLocal: async (db) =>
    db.all<FlashcardRow>(
      sql`SELECT f.id, f.sync_id, f.video_id, n.sync_id AS note_sync_id, f.front, f.back,
                 f.source_sec, f.ease, f.interval_days, f.due_at, f.reps, f.created_at, f.updated_at
          FROM flashcards f LEFT JOIN notes n ON n.id = f.note_id`,
    ),
  entityId: (row) => row.sync_id,
  updatedAt: (row) => row.updated_at,
  toPayload: (row) => row,
  upsertLocal: async (db, payload) => {
    const row = payload as FlashcardRow;
    await db.run(
      sql`INSERT INTO flashcards (sync_id, video_id, note_id, front, back, source_sec, ease,
                  interval_days, due_at, reps, created_at, updated_at)
          VALUES (${row.sync_id}, ${row.video_id},
                  (SELECT id FROM notes WHERE sync_id = ${row.note_sync_id}),
                  ${row.front}, ${row.back}, ${row.source_sec}, ${row.ease}, ${row.interval_days},
                  ${row.due_at}, ${row.reps}, ${row.created_at}, ${row.updated_at})
          ON CONFLICT (sync_id) DO UPDATE SET note_id = excluded.note_id, front = excluded.front,
            back = excluded.back, source_sec = excluded.source_sec, ease = excluded.ease,
            interval_days = excluded.interval_days, due_at = excluded.due_at, reps = excluded.reps,
            updated_at = excluded.updated_at`,
    );
  },
};

type AnyAdapter = EntityAdapter<any>;

/** FK-safe adapter order (pull applies sequentially). */
export const SYNC_ADAPTERS: AnyAdapter[] = [
  channelsAdapter,
  videosAdapter,
  conceptsAdapter,
  notesAdapter,
  analysesAdapter,
  flashcardsAdapter,
];
