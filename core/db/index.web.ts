import { drizzle as drizzleProxy } from 'drizzle-orm/sqlite-proxy';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';
import * as schema from './schema';

const DB_NAME = 'youtube_buddy.db';

let sqlite: SQLiteDatabase | null = null;
let db: ExpoSQLiteDatabase<typeof schema> | null = null;
let opening: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;

/**
 * Web variant of core/db (phase 11): expo-sqlite's wa-sqlite build,
 * drizzle wrapped via **sqlite-proxy** instead of the expo driver.
 *
 * Why: drizzle's expo-sqlite driver is sync-only (executeSync) and on web
 * sync ops need SharedArrayBuffer — which conflicts with the Google OAuth
 * popup (COOP same-origin breaks it, same-origin-allow-popups drops SAB;
 * user-reported login breakage + 'SharedArrayBuffer is not defined'
 * crashes). The proxy driver is async-native: it routes every drizzle
 * query through the callback below, which uses expo-sqlite's ASYNC web
 * API (`executeForRawResultAsync` for positional rows). No SAB anywhere,
 * OAuth popup works, repositories stay untouched.
 *
 * Invariants (verified): memoized open promise (OPFS = one handle per
 * file), close-on-failure, FTS5 absent in wa-sqlite (search degrades to
 * vector-only — core/search checks table existence).
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
    const proxy = drizzleProxy(
      async (sqlText, params, method) => {
        if (method === 'run') {
          await sqlite!.runAsync(sqlText, params);
          return { rows: [] as unknown[][] };
        }
        // positional rows (mapResultRow indexes by field order)
        const rows = await sqlite!
          .sql([sqlText] as unknown as TemplateStringsArray, ...params)
          .values();
        return { rows };
      },
      { schema },
    );
    // Structural twin of the expo driver's db (same BaseSQLiteDatabase
    // query-builder surface); the cast is deliberate and documented above.
    return proxy as unknown as ExpoSQLiteDatabase<typeof schema>;
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
 * Raw sqlite handle for call sites that must avoid drizzle entirely
 * (JSON backup import — verified phase 11).
 */
export async function getRawDb(): Promise<SQLiteDatabase> {
  await getDb();
  if (!sqlite) throw new Error('getRawDb: no sqlite handle');
  return sqlite;
}

export { schema };
