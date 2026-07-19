/**
 * Minimal migration runner.
 *
 * Migrations are ordered SQL batches with stable ids; applied ids are tracked
 * in the `__migrations` bookkeeping table. The runner is driver-agnostic so
 * it can be unit-tested without native SQLite (see migrations.test.ts).
 */

export interface SqliteExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string): Promise<T[]>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

export interface Migration {
  /** Stable, sortable id, e.g. '0001_init'. Never reused. */
  id: string;
  statements: string[];
}

export const migrations: Migration[] = [
  {
    id: '0001_init',
    statements: [
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
      'CREATE TABLE IF NOT EXISTS quota_log (day TEXT PRIMARY KEY, units_used INTEGER NOT NULL DEFAULT 0)',
    ],
  },
  {
    id: '0002_m1_youtube_read',
    statements: [
      'CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, title TEXT NOT NULL, thumbnail_url TEXT, subscriber_count INTEGER, updated_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS subscriptions (channel_id TEXT PRIMARY KEY REFERENCES channels(id), subscribed_at INTEGER NOT NULL, deleted_at INTEGER)',
      'CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id), title TEXT NOT NULL, duration_sec INTEGER, published_at INTEGER, thumbnail_url TEXT, description TEXT, updated_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS playlists (id TEXT PRIMARY KEY, title TEXT NOT NULL, item_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS playlist_items (playlist_id TEXT NOT NULL REFERENCES playlists(id), video_id TEXT NOT NULL REFERENCES videos(id), position INTEGER NOT NULL, PRIMARY KEY (playlist_id, video_id))',
    ],
  },
];

/**
 * Applies pending migrations in list order, each in its own transaction.
 * @returns ids of the migrations applied during this call.
 */
export async function runMigrations(
  db: SqliteExecutor,
  list: Migration[] = migrations,
): Promise<string[]> {
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  );
  const applied = await db.getAllAsync<{ id: string }>('SELECT id FROM __migrations');
  const done = new Set(applied.map((row) => row.id));

  const newlyApplied: string[] = [];
  for (const migration of list) {
    if (done.has(migration.id)) continue;
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.runAsync('INSERT INTO __migrations (id, applied_at) VALUES (?, ?)', [
        migration.id,
        Date.now(),
      ]);
    });
    newlyApplied.push(migration.id);
  }
  return newlyApplied;
}
