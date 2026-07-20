import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

/**
 * Web variant of core/db: no-op in phase 0.
 * expo-sqlite's web build requires wa-sqlite/wasm bundling; web persistence
 * (wa-sqlite/IndexedDB) is an open decision scheduled for phase 11
 * (ARCHITECTURE.md §11). Metro resolves this file instead of index.ts on web.
 */
export async function getDb(): Promise<ExpoSQLiteDatabase<typeof schema> | null> {
  return null;
}

/** No-op on web (no local DB yet — see getDb). */
export function resetDb(): void {}

export { schema };
