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

describe('core/db migration runner', () => {
  it('creates the empty initial schema and records it', async () => {
    const db = createFakeExecutor();
    const applied = await runMigrations(db);

    expect(applied).toEqual(['0001_init']);
    expect(db.executedSql).toContain(
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
    );
    expect(db.executedSql).toContain(
      'CREATE TABLE IF NOT EXISTS quota_log (day TEXT PRIMARY KEY, units_used INTEGER NOT NULL DEFAULT 0)',
    );
    expect(db.appliedIds).toEqual(['0001_init']);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const db = createFakeExecutor();
    await runMigrations(db);
    const second = await runMigrations(db);

    expect(second).toEqual([]);
    expect(db.appliedIds).toEqual(['0001_init']);
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
