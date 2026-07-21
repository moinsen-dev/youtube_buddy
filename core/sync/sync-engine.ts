import type { Db } from '@/core/db/repositories';

import { decryptPayload, encryptPayload } from './crypto';

/**
 * LWW sync engine (ADR PRD §7.6): push local changes newer than the last
 * sync, pull remote documents and apply newer ones. Last-write-wins per
 * entity; no tombstones in v1 (deletes stay local — documented ADR detail).
 * Everything crossing the wire is client-encrypted (the server is blind).
 */

export interface RemoteEntityDoc {
  entityId: string;
  ciphertext: string;
  updatedAt: number;
}

/** Transport abstraction — the Firestore REST client is one implementation. */
export interface SyncTransport {
  put: (
    kind: string,
    entityId: string,
    doc: { ciphertext: string; updatedAt: number },
  ) => Promise<void>;
  list: (kind: string) => Promise<RemoteEntityDoc[]>;
}

export interface EntityAdapter<Row = unknown> {
  kind: string;
  listLocal: (db: Db) => Promise<Row[]>;
  /** Stable cross-device id (sync_id or natural key). */
  entityId: (row: Row) => string;
  updatedAt: (row: Row) => number;
  /** Serializable payload — FK references already naturalized. */
  toPayload: (row: Row) => unknown;
  /** Applies a remote payload locally (resolves natural FKs to local ids). */
  upsertLocal: (db: Db, payload: unknown) => Promise<void>;
}

export interface SyncEngineOptions {
  db: Db;
  transport: SyncTransport;
  masterKey: Uint8Array;
  /** Adapters in FK-safe order (pull applies them sequentially). Row types
   * vary per adapter — the engine itself is row-agnostic. */
  adapters: EntityAdapter<any>[];
}

/** Pushes every local row with updatedAt > since. Returns the count. */
export async function pushChanges(options: SyncEngineOptions, since: number): Promise<number> {
  let pushed = 0;
  for (const adapter of options.adapters) {
    const rows = await adapter.listLocal(options.db);
    for (const row of rows) {
      const updatedAt = adapter.updatedAt(row);
      if (updatedAt <= since) continue;
      const ciphertext = encryptPayload(options.masterKey, adapter.toPayload(row));
      await options.transport.put(adapter.kind, adapter.entityId(row), {
        ciphertext,
        updatedAt,
      });
      pushed += 1;
    }
  }
  return pushed;
}

export interface PullReport {
  applied: number;
  skippedLocalNewer: number;
}

/** Pulls remote documents and applies the newer side (LWW). */
export async function pullChanges(options: SyncEngineOptions): Promise<PullReport> {
  const report: PullReport = { applied: 0, skippedLocalNewer: 0 };
  for (const adapter of options.adapters) {
    const remote = await options.transport.list(adapter.kind);
    if (remote.length === 0) continue;
    const localById = new Map(
      (await adapter.listLocal(options.db)).map((row) => [
        adapter.entityId(row),
        adapter.updatedAt(row),
      ]),
    );
    for (const doc of remote) {
      const localUpdatedAt = localById.get(doc.entityId);
      if (localUpdatedAt !== undefined && localUpdatedAt >= doc.updatedAt) {
        report.skippedLocalNewer += 1;
        continue;
      }
      const payload = decryptPayload(options.masterKey, doc.ciphertext);
      await adapter.upsertLocal(options.db, payload);
      report.applied += 1;
    }
  }
  return report;
}
