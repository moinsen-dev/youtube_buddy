import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';
import * as schema from './schema';

const DB_NAME = 'youtube_buddy.db';

// Strong module-scope refs for BOTH objects: drizzle may not retain the raw
// sqlite handle strongly, and once the JS object is GC'd (heavy GC pressure
// after llama model loads) the native finalizer closes the DB — every query
// then fails with NativeDatabase.prepareSync NPE.
let sqlite: SQLiteDatabase | null = null;
let db: ExpoSQLiteDatabase<typeof schema> | null = null;

/**
 * Lazily opens the local database and runs pending migrations.
 * Native only — on web Metro resolves index.web.ts instead, which returns
 * null (web persistence is an open decision for phase 11, ARCHITECTURE §11).
 *
 * Self-healing (Android, phase 5): llama.rn JSI activity can finalize the
 * NativeDatabase object under GC pressure — every later call then fails
 * with NativeDatabase.* NPEs. Probe the memoized handle cheaply and re-open
 * when it died.
 */
export async function getDb(): Promise<ExpoSQLiteDatabase<typeof schema> | null> {
  if (db && sqlite) {
    try {
      sqlite.prepareSync('SELECT 1').finalizeSync();
    } catch {
      resetDb();
    }
  }
  if (!db) {
    // useNewConnection: bypasses expo-sqlite's shared database registry —
    // after llama.rn JSI activity (model load), handles from that registry
    // intermittently die with NativeDatabase.* NPEs on Android (known
    // expo-sqlite issue; fresh-connection is the documented workaround).
    sqlite = openDatabaseSync(DB_NAME, { useNewConnection: true });
    const applied = await runMigrations(sqlite);
    console.log(`[db] ready — migrations applied: ${applied.length ? applied.join(', ') : 'none'}`);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

/**
 * Drops the current handle so the next getDb() re-opens. Needed on Android:
 * initLlama (llama.rn JSI) intermittently invalidates the NativeDatabase
 * JSI object — every prepareSync then NPEs. A fresh handle opened AFTER the
 * engine load works again (verified in phase 5).
 */
export function resetDb(): void {
  try {
    sqlite?.closeSync();
  } catch {
    // already broken — nothing to close
  }
  sqlite = null;
  db = null;
}

/**
 * Raw sqlite handle for the rare call sites that must avoid drizzle's
 * sync-only driver on web (wa-sqlite deadlocks on sync sequences, phase 11
 * — the JSON backup import). Opens the DB when needed.
 */
export async function getRawDb(): Promise<SQLiteDatabase> {
  await getDb();
  if (!sqlite) throw new Error('getRawDb: no sqlite handle');
  return sqlite;
}

export { schema };
