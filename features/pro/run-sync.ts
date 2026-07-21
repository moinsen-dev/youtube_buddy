import { getSetting, setSetting, type Db } from '@/core/db/repositories';
import { createFirestoreTransport } from '@/core/sync/firestore-client';
import { SYNC_ADAPTERS } from '@/core/sync/entities';
import { pullChanges, pushChanges, type PullReport } from '@/core/sync/sync-engine';

import { getFirebaseConfig, type ProSession } from './pro-session';

/**
 * One-shot sync run (ADR PRD §7.6): push local changes since the last run,
 * then pull remote ones (LWW). The wrapped master key lives under the same
 * owner tree as a `meta` entity (it is itself wrapped with the recovery
 * code — still blind to the server).
 */

const LAST_SYNC_KEY = 'last_sync.pro';

export interface SyncRunReport {
  pushed: number;
  pull: PullReport;
}

export async function runSync(db: Db, session: ProSession): Promise<SyncRunReport> {
  const config = getFirebaseConfig();
  if (!config) throw new Error('Keine Firebase-Konfiguration für diese Umgebung');
  const masterKey = await session.getMasterKey();
  if (!masterKey) {
    throw new Error('Sync nicht aktiviert — zuerst Recovery-Code erzeugen oder eingeben');
  }
  const transport = createFirestoreTransport({
    projectId: config.projectId,
    getIdToken: () => session.getIdToken(),
    getUid: () => session.getUid(),
  });
  const options = { db, transport, masterKey, adapters: SYNC_ADAPTERS };

  const since = Number((await getSetting(db, LAST_SYNC_KEY)) ?? 0);
  const pushed = await pushChanges(options, since);
  const pull = await pullChanges(options);
  await setSetting(db, LAST_SYNC_KEY, String(Date.now()));
  return { pushed, pull };
}

/** Uploads the wrapped master key (first device, enableSync). */
export async function uploadWrappedKey(session: ProSession, wrappedB64: string): Promise<void> {
  const config = getFirebaseConfig();
  if (!config) throw new Error('Keine Firebase-Konfiguration');
  const transport = createFirestoreTransport({
    projectId: config.projectId,
    getIdToken: () => session.getIdToken(),
    getUid: () => session.getUid(),
  });
  await transport.put('meta', 'master_key', { ciphertext: wrappedB64, updatedAt: Date.now() });
}

/** Fetches the wrapped master key (further devices, joinSync). */
export async function fetchWrappedKey(session: ProSession): Promise<string | null> {
  const config = getFirebaseConfig();
  if (!config) throw new Error('Keine Firebase-Konfiguration');
  const transport = createFirestoreTransport({
    projectId: config.projectId,
    getIdToken: () => session.getIdToken(),
    getUid: () => session.getUid(),
  });
  const docs = await transport.list('meta');
  return docs.find((doc) => doc.entityId === 'master_key')?.ciphertext ?? null;
}
