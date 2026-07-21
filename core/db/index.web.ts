import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';
import * as schema from './schema';

const DB_NAME = 'youtube_buddy.db';

let sqlite: SQLiteDatabase | null = null;
let db: ExpoSQLiteDatabase<typeof schema> | null = null;
let opening: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;

/**
 * Web variant of core/db (phase 11): expo-sqlite's web build (wa-sqlite
 * WASM + worker, persisted via OPFS/IndexedDB). ASYNC open on purpose: the
 * sync API times out on web ("Sync operation timeout", verified).
 *
 * Two hard-won invariants (verified against real failures):
 * - OPFS allows exactly ONE sync access handle per file. Concurrent getDb()
 *   callers (layout + screens at boot) therefore share a single memoized
 *   OPEN PROMISE — a second parallel open dies with 'unable to open
 *   database file' / 'sqlite3_open_v2'.
 * - A failed open/migrate must CLOSE the handle before dropping it, or the
 *   leaked OPFS handle blocks every later open (NoModificationAllowedError).
 */
export async function getDb(): Promise<ExpoSQLiteDatabase<typeof schema> | null> {
  if (db) return db;
  opening ??= openAndMigrate();
  try {
    db = await opening;
    return db;
  } finally {
    if (!db) opening = null; // allow retry after failure
  }
}

async function openAndMigrate(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  sqlite = await openDatabaseAsync(DB_NAME);
  try {
    const applied = await runMigrations(sqlite);
    console.log(
      `[db] ready (web) — migrations applied: ${applied.length ? applied.join(', ') : 'none'}`,
    );
    return drizzle(sqlite, { schema });
  } catch (cause) {
    try {
      await sqlite.closeAsync();
    } catch {
      // closing a broken handle is best-effort
    }
    sqlite = null;
    throw cause;
  }
}

/** Drops the current handle so the next getDb() re-opens. */
export function resetDb(): void {
  try {
    sqlite?.closeSync();
  } catch {
    // already broken — nothing to close
  }
  sqlite = null;
  db = null;
  opening = null;
}

/**
 * Raw sqlite handle for call sites that must avoid drizzle's sync-only
 * driver on web (wa-sqlite deadlocks on sync sequences, phase 11).
 */
export async function getRawDb(): Promise<SQLiteDatabase> {
  await getDb();
  if (!sqlite) throw new Error('getRawDb: no sqlite handle');
  return sqlite;
}

export { schema };
