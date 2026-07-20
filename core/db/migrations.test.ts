import { runMigrations, type Migration, type SqliteExecutor } from './migrations';

/** In-memory executor recording every call — lets the runner be tested
 * without native SQLite. */
function createFakeExecutor(): SqliteExecutor & {
  appliedIds: string[];
  executedSql: string[];
  transactionDepth: number;
  maxTransactionDepth: number;
} {
  const state = {
    appliedIds: [] as string[],
    executedSql: [] as string[],
    transactionDepth: 0,
    maxTransactionDepth: 0,
  };

  return {
    get appliedIds() {
      return state.appliedIds;
    },
    get executedSql() {
      return state.executedSql;
    },
    get transactionDepth() {
      return state.transactionDepth;
    },
    get maxTransactionDepth() {
      return state.maxTransactionDepth;
    },
    async execAsync(sql: string) {
      state.executedSql.push(sql);
    },
    async runAsync(sql: string, params?: (string | number | null)[]) {
      if (sql.startsWith('INSERT INTO __migrations') && params) {
        state.appliedIds.push(String(params[0]));
      }
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      if (sql.startsWith('SELECT id FROM __migrations')) {
        return state.appliedIds.map((id) => ({ id })) as T[];
      }
      return [];
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      state.transactionDepth += 1;
      state.maxTransactionDepth = Math.max(state.maxTransactionDepth, state.transactionDepth);
      try {
        await fn();
      } finally {
        state.transactionDepth -= 1;
      }
    },
  };
}

const MIGRATION_IDS = [
  '0001_init',
  '0002_m1_youtube_read',
  '0003_m2_watch_tracking',
  '0004_m3_transcripts',
];

describe('core/db migration runner', () => {
  it('creates the empty initial schema and records it', async () => {
    const db = createFakeExecutor();
    const applied = await runMigrations(db);

    expect(applied).toEqual(MIGRATION_IDS);
    expect(db.executedSql).toContain(
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
    );
    expect(
      db.executedSql.some((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS watch_sessions')),
    ).toBe(true);
    expect(
      db.executedSql.some((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS transcripts')),
    ).toBe(true);
    expect(
      db.executedSql.some((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS transcript_chunks')),
    ).toBe(true);
    expect(db.appliedIds).toEqual(MIGRATION_IDS);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const db = createFakeExecutor();
    await runMigrations(db);
    const second = await runMigrations(db);

    expect(second).toEqual([]);
    expect(db.appliedIds).toEqual(MIGRATION_IDS);
  });

  it('runs each migration inside a transaction', async () => {
    const db = createFakeExecutor();
    await runMigrations(db);
    expect(db.maxTransactionDepth).toBe(1);
    expect(db.transactionDepth).toBe(0); // properly closed
  });

  it('applies only pending migrations from a longer list', async () => {
    const extra: Migration[] = [
      { id: '0001_init', statements: ['CREATE TABLE a (id TEXT)'] },
      { id: '0002_second', statements: ['CREATE TABLE b (id TEXT)'] },
    ];
    const db = createFakeExecutor();
    await runMigrations(db, extra.slice(0, 1));
    const applied = await runMigrations(db, extra);

    expect(applied).toEqual(['0002_second']);
    expect(db.appliedIds).toEqual(['0001_init', '0002_second']);
  });
});
