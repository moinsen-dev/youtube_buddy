import { sql } from 'drizzle-orm';

import type { Db } from '@/core/db/repositories';
import { getRawDb } from '@/core/db';
import type { SqliteExecutor } from '@/core/db/migrations';

/**
 * JSON backup bridge (M10, ROADMAP phase 11): the only file-based way to
 * move ALL local data between devices (Phone ↔ Web). Plain JSON, ids
 * preserved (same-table ids stay valid on the target), INSERT OR REPLACE
 * everywhere, one transaction per table.
 *
 * Hardening: column names from the file are intersected with the real
 * schema (PRAGMA table_info) — a crafted backup cannot smuggle SQL via
 * identifiers, and forward-compatible extra columns are ignored. Values
 * are always bound as parameters. No explicit transactions: drizzle's
 * expo-sqlite transactions hang on web (sync API, verified phase 11) —
 * INSERT OR REPLACE is idempotent, so a retry simply completes the table.
 *
 * Excluded by design: quota_log (ephemeral), embeddings (blob + recomputable
 * — the target re-indexes with its own model), models.
 */

export const BACKUP_VERSION = 1;

const TABLES = [
  'channels',
  'subscriptions',
  'playlists',
  'videos',
  'playlist_items',
  'watch_sessions',
  'transcripts',
  'transcript_chunks',
  'concepts',
  'notes',
  'note_links',
  'analyses',
  'guides',
  'habits',
  'habit_checks',
  'flashcards',
  'flashcard_reviews',
  'trips',
  'trip_places',
  'settings',
] as const;

type TableName = (typeof TABLES)[number];

export interface BackupDoc {
  kind: 'youtube-buddy-backup';
  version: number;
  exportedAt: number;
  tables: Partial<Record<TableName, Record<string, unknown>[]>>;
}

/** Serializes every portable table. */
export async function buildBackup(db: Db): Promise<BackupDoc> {
  const tables: BackupDoc['tables'] = {};
  for (const table of TABLES) {
    tables[table] = await db.all<Record<string, unknown>>(sql.raw(`SELECT * FROM ${table}`));
  }
  return { kind: 'youtube-buddy-backup', version: BACKUP_VERSION, exportedAt: Date.now(), tables };
}

export interface ImportReport {
  tables: number;
  rows: number;
}

async function tableColumns(db: SqliteExecutor, table: TableName): Promise<Set<string>> {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(info.map((column) => column.name));
}

/** Validates the envelope and upserts every row (FK-safe table order). All
 * writes go through the RAW sqlite executor (getRawDb) — drizzle's
 * sync-only driver hangs on web (wa-sqlite, verified phase 11); the raw
 * async calls work identically on native and web. */
export async function importBackup(db: Db, doc: BackupDoc): Promise<ImportReport> {
  if (doc?.kind !== 'youtube-buddy-backup' || typeof doc.version !== 'number') {
    throw new Error('Kein YouTube-Buddy-Backup (kind/version fehlt)');
  }
  if (doc.version > BACKUP_VERSION) {
    throw new Error(`Backup-Version ${doc.version} ist neuer als diese App (${BACKUP_VERSION})`);
  }
  const raw = await getRawDb();
  let rows = 0;
  let tables = 0;
  for (const table of TABLES) {
    const entries = doc.tables[table];
    if (!entries || entries.length === 0) continue;
    const allowed = await tableColumns(raw, table);
    tables += 1;
    try {
      // No explicit transaction: drizzle's expo-sqlite transactions run on
      // the sync API, which hangs on web (wa-sqlite, verified phase 11).
      // INSERT OR REPLACE is atomic per row and idempotent — a retry after
      // an error simply completes the table.
      for (const entry of entries) {
        const columns = Object.keys(entry).filter((column) => allowed.has(column));
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const params = columns.map((column) => entry[column] as string | number | null);
        await raw.runAsync(
          `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          params,
        );
        rows += 1;
      }
    } catch (cause) {
      throw new Error(
        `Import in Tabelle ${table} fehlgeschlagen: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  return { tables, rows };
}
