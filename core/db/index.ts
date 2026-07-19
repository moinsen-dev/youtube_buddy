import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { runMigrations } from './migrations';
import * as schema from './schema';

const DB_NAME = 'youtube_buddy.db';

let db: ExpoSQLiteDatabase<typeof schema> | null = null;

/**
 * Lazily opens the local database and runs pending migrations.
 * Native only — on web Metro resolves index.web.ts instead, which returns
 * null (web persistence is an open decision for phase 11, ARCHITECTURE §11).
 */
export async function getDb(): Promise<ExpoSQLiteDatabase<typeof schema> | null> {
  if (!db) {
    const sqlite = openDatabaseSync(DB_NAME);
    const applied = await runMigrations(sqlite);
    console.log(`[db] ready — migrations applied: ${applied.length ? applied.join(', ') : 'none'}`);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export { schema };
