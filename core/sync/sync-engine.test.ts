import type { Db } from '@/core/db/repositories';

import { decryptPayload, encryptPayload, generateMasterKey } from './crypto';
import {
  pullChanges,
  pushChanges,
  type EntityAdapter,
  type RemoteEntityDoc,
  type SyncTransport,
} from './sync-engine';

/** In-memory transport — simulates the blind server (stores ciphertext). */
function createFakeTransport() {
  const store = new Map<string, RemoteEntityDoc>();
  const transport: SyncTransport = {
    put: async (kind, entityId, doc) => {
      store.set(`${kind}/${entityId}`, { entityId, ...doc });
    },
    list: async (kind) =>
      [...store.entries()].filter(([key]) => key.startsWith(`${kind}/`)).map(([, doc]) => doc),
  };
  return { transport, store };
}

interface FakeRow {
  id: string;
  updated: number;
  text: string;
}

function createFakeAdapter(rows: FakeRow[], applied: unknown[]): EntityAdapter<FakeRow> {
  return {
    kind: 'fakes',
    listLocal: async () => rows,
    entityId: (row) => row.id,
    updatedAt: (row) => row.updated,
    toPayload: (row) => ({ text: row.text }),
    upsertLocal: async (_db, payload) => {
      applied.push(payload);
    },
  };
}

const fakeDb = null as unknown as Db;

describe('sync engine (LWW)', () => {
  it('pushes only rows newer than since, encrypted', async () => {
    const masterKey = generateMasterKey();
    const { transport, store } = createFakeTransport();
    const rows = [
      { id: 'a', updated: 100, text: 'alt' },
      { id: 'b', updated: 200, text: 'geheim' },
    ];
    const pushed = await pushChanges(
      { db: fakeDb, transport, masterKey, adapters: [createFakeAdapter(rows, [])] },
      150,
    );
    expect(pushed).toBe(1);
    const doc = store.get('fakes/b')!;
    expect(doc.updatedAt).toBe(200);
    expect(doc.ciphertext).not.toContain('geheim');
    // server can hold it, only the owner can read it
    expect(decryptPayload(masterKey, doc.ciphertext)).toEqual({ text: 'geheim' });
  });

  it('pull applies remote-newer docs and skips local-newer ones', async () => {
    const masterKey = generateMasterKey();
    const { transport, store } = createFakeTransport();
    store.set('fakes/a', {
      entityId: 'a',
      updatedAt: 200,
      ciphertext: encryptPayload(masterKey, { text: 'remote neu' }),
    });
    store.set('fakes/b', {
      entityId: 'b',
      updatedAt: 100,
      ciphertext: encryptPayload(masterKey, { text: 'remote alt' }),
    });
    const localRows = [
      { id: 'a', updated: 100, text: 'lokal' },
      { id: 'b', updated: 300, text: 'lokal neuer' },
    ];
    const applied: unknown[] = [];
    const report = await pullChanges({
      db: fakeDb,
      transport,
      masterKey,
      adapters: [createFakeAdapter(localRows, applied)],
    });
    expect(report).toEqual({ applied: 1, skippedLocalNewer: 1 });
    expect(applied).toEqual([{ text: 'remote neu' }]);
  });
});
