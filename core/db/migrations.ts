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
  {
    id: '0007_m11_knowledge_base',
    statements: [
      'CREATE TABLE IF NOT EXISTS concepts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, note_id INTEGER REFERENCES notes(id), created_at INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS note_links (id INTEGER PRIMARY KEY AUTOINCREMENT, src_note_id INTEGER NOT NULL REFERENCES notes(id), dst_note_id INTEGER REFERENCES notes(id), dst_concept_name TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0)',
      'CREATE INDEX IF NOT EXISTS idx_note_links_src ON note_links (src_note_id)',
      'CREATE INDEX IF NOT EXISTS idx_note_links_dst ON note_links (dst_note_id)',
      'CREATE INDEX IF NOT EXISTS idx_notes_type_updated ON notes (type, updated_at)',
    ],
  },
  {
    id: '0008_m7_travel',
    statements: [
      'CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, note_id INTEGER REFERENCES notes(id), created_at INTEGER NOT NULL)',
      "CREATE TABLE IF NOT EXISTS trip_places (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL REFERENCES trips(id), video_id TEXT NOT NULL REFERENCES videos(id), name TEXT NOT NULL, lat REAL, lon REAL, source_sec INTEGER, position INTEGER NOT NULL, geocode_status TEXT NOT NULL DEFAULT 'pending')",
      'CREATE INDEX IF NOT EXISTS idx_trip_places_trip ON trip_places (trip_id, position)',
    ],
  },
  {
    id: '0009_m8_embeddings',
    statements: [
      'CREATE TABLE IF NOT EXISTS embeddings (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL, vector BLOB NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(owner_type, owner_id, model))',
      'CREATE INDEX IF NOT EXISTS idx_embeddings_owner ON embeddings (owner_type, owner_id)',
      'CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(text)',
      'CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, body_md)',
    ],
  },
  {
    id: '0010_m9_hygiene',
    statements: [
      // subscriptions.delete needs the API subscription resource id (M9).
      'ALTER TABLE subscriptions ADD COLUMN youtube_sub_id TEXT',
    ],
  },
  {
    id: '0011_m95_sync',
    statements: [
      // LWW change tracking for Pro-Sync (ADR PRD §7.6).
      'ALTER TABLE flashcards ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0',
      'UPDATE flashcards SET updated_at = created_at WHERE updated_at = 0',
      // Stable cross-device ids (local autoincrement ids collide between
      // devices). Triggers fill sync_id on every insert path automatically.
      'ALTER TABLE notes ADD COLUMN sync_id TEXT',
      'ALTER TABLE flashcards ADD COLUMN sync_id TEXT',
      'UPDATE notes SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL',
      'UPDATE flashcards SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_notes_sync_id ON notes (sync_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_flashcards_sync_id ON flashcards (sync_id)',
      `CREATE TRIGGER IF NOT EXISTS notes_sync_id_default AFTER INSERT ON notes
       WHEN NEW.sync_id IS NULL BEGIN
         UPDATE notes SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
       END`,
      `CREATE TRIGGER IF NOT EXISTS flashcards_sync_id_default AFTER INSERT ON flashcards
       WHEN NEW.sync_id IS NULL BEGIN
         UPDATE flashcards SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
       END`,
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

  // expo-sqlite's wa-sqlite WASM build ships WITHOUT FTS5 ('no such module:
  // fts5' on web, verified in phase 11) — FTS statements are skipped there
  // and the search layer degrades to vector-only (core/search checks table
  // existence). Native keeps full FTS5.
  const fts5 = await supportsFts5(db);

  const newlyApplied: string[] = [];
  for (const migration of list) {
    if (done.has(migration.id)) continue;
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        if (!fts5 && statement.includes('fts5')) {
          console.log(`[db] skipping FTS5 statement (unsupported here): ${migration.id}`);
          continue;
        }
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

/** True when the SQLite build includes FTS5 (false on expo-sqlite web). */
async function supportsFts5(db: SqliteExecutor): Promise<boolean> {
  try {
    const rows = await db.getAllAsync<{ used: number }>(
      `SELECT sqlite_compileoption_used('ENABLE_FTS5') AS used`,
    );
    return rows[0]?.used === 1;
  } catch {
    return false;
  }
}
