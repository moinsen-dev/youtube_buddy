import { decideQuota, guardQuota, quotaDayKey, QuotaBlockedError, type QuotaStore } from './quota';

function createMemoryStore(
  initial: Record<string, number> = {},
): QuotaStore & { data: Record<string, number> } {
  const data: Record<string, number> = { ...initial };
  return {
    data,
    async getUnitsUsed(day: string) {
      return data[day] ?? 0;
    },
    async addUnits(day: string, units: number) {
      data[day] = (data[day] ?? 0) + units;
      return data[day];
    },
  };
}

describe('core/youtube quota (ARCHITECTURE §6)', () => {
  it('allows calls well under the daily limit', () => {
    expect(decideQuota(0, 1)).toBe('allow');
    expect(decideQuota(7999, 1)).toBe('allow');
  });

  it('warns once a call pushes usage past 80 %', () => {
    expect(decideQuota(8000, 1)).toBe('warn'); // 8001/10000 > 0.8
    expect(decideQuota(8000, 100)).toBe('warn');
  });

  it('blocks when the call would exceed the limit', () => {
    expect(decideQuota(10_000, 1)).toBe('block');
    expect(decideQuota(9990, 100)).toBe('block');
  });

  it('formats the day key as YYYY-MM-DD (UTC)', () => {
    expect(quotaDayKey(new Date('2026-07-19T14:30:00Z'))).toBe('2026-07-19');
  });

  it('counts every recorded call exactly once (exit criterion)', async () => {
    const store = createMemoryStore();
    const day = '2026-07-19';
    await guardQuota(store, 'subscriptions.list', { day });
    await guardQuota(store, 'videos.list', { day });
    await guardQuota(store, 'playlists.list', { day });
    expect(store.data[day]).toBe(3);
  });

  it('keeps separate counters per day', async () => {
    const store = createMemoryStore({ '2026-07-18': 42 });
    await guardQuota(store, 'videos.list', { day: '2026-07-19' });
    expect(store.data['2026-07-18']).toBe(42);
    expect(store.data['2026-07-19']).toBe(1);
  });

  it('warns via callback and still records the call', async () => {
    const store = createMemoryStore({ '2026-07-19': 8000 });
    const warnings: number[] = [];
    await guardQuota(store, 'videos.list', { day: '2026-07-19', onWarn: (u) => warnings.push(u) });
    expect(warnings).toEqual([8001]);
    expect(store.data['2026-07-19']).toBe(8001);
  });

  it('throws QuotaBlockedError and does not record when blocked', async () => {
    const store = createMemoryStore({ '2026-07-19': 10_000 });
    await expect(guardQuota(store, 'videos.list', { day: '2026-07-19' })).rejects.toBeInstanceOf(
      QuotaBlockedError,
    );
    expect(store.data['2026-07-19']).toBe(10_000);
  });
});
