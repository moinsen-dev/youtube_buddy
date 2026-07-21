/**
 * Firestore over the plain REST API (ADR PRD §7.6 whitelist:
 * firestore.googleapis.com). Only what Pro-Sync needs: upsert + list of
 * per-user entity documents. The server only ever sees ciphertext — rules
 * (firestore.rules) restrict access to the owner's tree. Fetch injectable.
 */

export interface FirestoreConfig {
  projectId: string;
  /** Returns a fresh Firebase ID token (bearer). */
  getIdToken: () => Promise<string>;
  /** Firebase Auth uid — owner path segment (rules: users/{uid}/…). */
  getUid: () => Promise<string>;
}

export interface RemoteEntity {
  /** Local entity id encoded into the document name. */
  entityId: string;
  ciphertext: string;
  updatedAt: number;
}

type FetchFn = typeof fetch;

function baseUrl(config: FirestoreConfig): string {
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
}

/** Upserts one encrypted entity document (LWW decided by the caller). */
export async function putEntity(
  config: FirestoreConfig,
  kind: string,
  entityId: string,
  entity: { ciphertext: string; updatedAt: number },
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const path = `${baseUrl(config)}/users/${await configUid(config)}/entities_${kind}/${entityId}`;
  const token = await config.getIdToken();
  const response = await fetchFn(
    `${path}?updateMask.fieldPaths=ciphertext&updateMask.fieldPaths=updated_at`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ciphertext: { stringValue: entity.ciphertext },
          updated_at: { integerValue: String(entity.updatedAt) },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Firestore put ${kind}/${entityId} failed (${response.status})`);
  }
}

/** Lists all encrypted entity documents of one kind for the user. */
export async function listEntities(
  config: FirestoreConfig,
  kind: string,
  fetchFn: FetchFn = fetch,
): Promise<RemoteEntity[]> {
  const token = await config.getIdToken();
  const out: RemoteEntity[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `${baseUrl(config)}/users/${await configUid(config)}/entities_${kind}` +
      `?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(`Firestore list ${kind} failed (${response.status})`);
    }
    const data = (await response.json()) as {
      documents?: {
        name: string;
        fields?: {
          ciphertext?: { stringValue?: string };
          updated_at?: { integerValue?: string };
        };
      }[];
      nextPageToken?: string;
    };
    for (const doc of data.documents ?? []) {
      const ciphertext = doc.fields?.ciphertext?.stringValue;
      const updatedAt = Number(doc.fields?.updated_at?.integerValue ?? 0);
      if (ciphertext) {
        out.push({ entityId: doc.name.split('/').pop() ?? '', ciphertext, updatedAt });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// The uid is part of every path; resolved once and cached per config object.
const uidCache = new WeakMap<FirestoreConfig, Promise<string>>();

function configUid(config: FirestoreConfig): Promise<string> {
  let cached = uidCache.get(config);
  if (!cached) {
    if (!config.getUid) {
      throw new Error('FirestoreConfig.getUid missing');
    }
    cached = config.getUid();
    uidCache.set(config, cached);
  }
  return cached;
}

/** Firestore REST as SyncTransport for the sync engine. */
export function createFirestoreTransport(config: FirestoreConfig): {
  put: (
    kind: string,
    entityId: string,
    doc: { ciphertext: string; updatedAt: number },
  ) => Promise<void>;
  list: (kind: string) => Promise<RemoteEntity[]>;
} {
  return {
    put: (kind, entityId, doc) => putEntity(config, kind, entityId, doc),
    list: (kind) => listEntities(config, kind),
  };
}
