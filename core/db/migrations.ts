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
  {
    id: '0003_m2_watch_tracking',
    statements: [
      "CREATE TABLE IF NOT EXISTS watch_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL REFERENCES videos(id), started_at INTEGER NOT NULL, ended_at INTEGER, position_sec INTEGER NOT NULL DEFAULT 0, percent_watched REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'player')",
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_video_started ON watch_sessions (video_id, started_at)',
    ],
  },
  {
    id: '0004_m3_transcripts',
    statements: [
      'CREATE TABLE IF NOT EXISTS transcripts (video_id TEXT PRIMARY KEY REFERENCES videos(id), lang TEXT, source TEXT, fetched_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS transcript_chunks (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL REFERENCES videos(id), idx INTEGER NOT NULL, start_sec REAL NOT NULL, end_sec REAL NOT NULL, text TEXT NOT NULL, embedding_id INTEGER)',
      'CREATE INDEX IF NOT EXISTS idx_transcript_chunks_video_idx ON transcript_chunks (video_id, idx)',
    ],
  },
  {
    id: '0005_m5_analyses',
    statements: [
      'CREATE TABLE IF NOT EXISTS analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL REFERENCES videos(id), kind TEXT NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(video_id, kind))',
      'CREATE INDEX IF NOT EXISTS idx_analyses_video_kind ON analyses (video_id, kind)',
    ],
  },
  {
    id: '0006_m6_knowledge',
    statements: [
      'CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT REFERENCES videos(id), concept_id INTEGER, type TEXT NOT NULL, title TEXT NOT NULL, body_md TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS flashcards (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL REFERENCES videos(id), note_id INTEGER REFERENCES notes(id), front TEXT NOT NULL, back TEXT NOT NULL, source_sec INTEGER, ease REAL NOT NULL DEFAULT 2.5, interval_days INTEGER NOT NULL DEFAULT 0, due_at INTEGER NOT NULL, reps INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)',
      'CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards (due_at)',
      'CREATE TABLE IF NOT EXISTS flashcard_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL REFERENCES flashcards(id), reviewed_at INTEGER NOT NULL, grade INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL REFERENCES videos(id), note_id INTEGER REFERENCES notes(id), title TEXT NOT NULL, cue TEXT, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS habit_checks (habit_id INTEGER NOT NULL REFERENCES habits(id), day TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (habit_id, day))',
      'CREATE TABLE IF NOT EXISTS guides (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL REFERENCES videos(id), note_id INTEGER REFERENCES notes(id), title TEXT NOT NULL, payload TEXT NOT NULL, progress_step INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
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
