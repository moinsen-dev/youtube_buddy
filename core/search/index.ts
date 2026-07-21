import { sql } from 'drizzle-orm';

import type { Db } from '@/core/db/repositories';
import type { LLMEngine } from '@/core/ai-engine/types';

/**
 * Vector helpers (M8): cosine similarity over Float32Array vectors stored as
 * raw bytes in the embeddings table. JS-kNN (no sqlite-vec native build) —
 * decision documented in STATE.md: trivial at our corpus sizes (~10⁴ items).
 */

export function float32ToBytes(vector: Float32Array): Uint8Array {
  return new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function bytesToFloat32(bytes: Uint8Array): Float32Array {
  const copy = new Uint8Array(bytes);
  return new Float32Array(copy.buffer, 0, copy.byteLength / 4);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface EmbeddingRow {
  ownerType: 'transcript_chunk' | 'note' | 'concept' | 'analysis';
  ownerId: number;
  vector: Uint8Array;
}

/** k nearest neighbors by cosine similarity (descending). */
export function knn(
  query: Float32Array,
  rows: EmbeddingRow[],
  k: number,
): { row: EmbeddingRow; score: number }[] {
  const scored = rows.map((row) => ({
    row,
    score: cosineSimilarity(query, bytesToFloat32(row.vector)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Reciprocal rank fusion over multiple ranked lists (typed key `type:id` →
 * combined score). k = 60 (standard). Higher weight for semantic ranks
 * (hybrid bias). Keys must carry the owner type — raw rowids collide across
 * tables (note 3 vs. analysis 3), which previously scrambled the ranking.
 */
export function reciprocalRankFusion(
  lists: { ids: string[]; weight?: number }[],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const { ids, weight = 1 } of lists) {
    ids.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + weight / (k + index + 1));
    });
  }
  return scores;
}

export function ownerKey(ownerType: EmbeddingRow['ownerType'], ownerId: number): string {
  return `${ownerType}:${ownerId}`;
}

/** Text used to embed each owner type. */
export async function ownerText(
  db: Db,
  ownerType: EmbeddingRow['ownerType'],
  ownerId: number,
): Promise<string | null> {
  if (ownerType === 'transcript_chunk') {
    const rows = await db.all<{ text: string }>(
      sql`SELECT text FROM transcript_chunks WHERE id = ${ownerId}`,
    );
    return rows[0]?.text ?? null;
  }
  if (ownerType === 'note') {
    const rows = await db.all<{ title: string; body_md: string }>(
      sql`SELECT title, body_md FROM notes WHERE id = ${ownerId}`,
    );
    return rows[0] ? `${rows[0].title}\n${rows[0].body_md.slice(0, 1200)}` : null;
  }
  if (ownerType === 'concept') {
    // Embed the concept's note text when linked — a bare display name lands
    // in a short-token cluster that matches nearly every short query and
    // poisons the ranking (verified in phase 9).
    const rows = await db.all<{ display_name: string; body_md: string | null }>(
      sql`SELECT c.display_name, n.body_md FROM concepts c
          LEFT JOIN notes n ON n.id = c.note_id WHERE c.id = ${ownerId}`,
    );
    if (!rows[0]) return null;
    return rows[0].body_md
      ? `${rows[0].display_name}\n${rows[0].body_md.slice(0, 1200)}`
      : rows[0].display_name;
  }
  const rows = await db.all<{ payload: string }>(
    sql`SELECT payload FROM analyses WHERE id = ${ownerId}`,
  );
  return rows[0]?.payload.slice(0, 1200) ?? null;
}

/**
 * Embeds all owners missing from the embeddings table (incremental index
 * job, M8). Returns how many vectors were written.
 */
export async function indexMissingEmbeddings(
  engine: LLMEngine,
  db: Db,
  modelId: string,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<number> {
  const missing = await db.all<{ owner_type: EmbeddingRow['ownerType']; owner_id: number }>(
    sql`SELECT c.id AS owner_id, 'transcript_chunk' AS owner_type FROM transcript_chunks c
        LEFT JOIN embeddings e ON e.owner_type = 'transcript_chunk' AND e.owner_id = c.id AND e.model = ${modelId}
        WHERE e.id IS NULL
        UNION ALL
        SELECT n.id, 'note' FROM notes n
        LEFT JOIN embeddings e ON e.owner_type = 'note' AND e.owner_id = n.id AND e.model = ${modelId}
        WHERE e.id IS NULL
        UNION ALL
        SELECT co.id, 'concept' FROM concepts co
        LEFT JOIN embeddings e ON e.owner_type = 'concept' AND e.owner_id = co.id AND e.model = ${modelId}
        WHERE e.id IS NULL
        UNION ALL
        SELECT a.id, 'analysis' FROM analyses a
        LEFT JOIN embeddings e ON e.owner_type = 'analysis' AND e.owner_id = a.id AND e.model = ${modelId}
        WHERE e.id IS NULL`,
  );

  let done = 0;
  for (const owner of missing) {
    if (signal?.aborted) break;
    const text = await ownerText(db, owner.owner_type, owner.owner_id);
    if (text && text.trim().length > 0) {
      const [vector] = await engine.embed([text]);
      await db.run(
        sql`INSERT OR REPLACE INTO embeddings (owner_type, owner_id, vector, model, created_at)
            VALUES (${owner.owner_type}, ${owner.owner_id}, ${float32ToBytes(vector)}, ${modelId}, ${Date.now()})`,
      );
    }
    done += 1;
    onProgress?.(done, missing.length);
  }

  // Keep the FTS tables in sync when the build has FTS5 (rebuilt wholesale —
  // cheap at our sizes). expo-sqlite's web WASM has no FTS5 (phase 11):
  // tables are absent there and search degrades to vector-only.
  if (await hasFtsTables(db)) {
    await db.run(sql`DELETE FROM chunks_fts`);
    await db.run(sql`INSERT INTO chunks_fts (rowid, text) SELECT id, text FROM transcript_chunks`);
    await db.run(sql`DELETE FROM notes_fts`);
    await db.run(
      sql`INSERT INTO notes_fts (rowid, title, body_md) SELECT id, title, body_md FROM notes`,
    );
  }

  return done;
}

/** True when the FTS5 tables exist (false on expo-sqlite web, phase 11). */
export async function hasFtsTables(db: Db): Promise<boolean> {
  const rows = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('chunks_fts', 'notes_fts')`,
  );
  return rows.length === 2;
}

export interface ScoredOwner {
  ownerType: EmbeddingRow['ownerType'];
  ownerId: number;
  vectorScore: number;
  fusedScore: number;
}

/**
 * Hybrid search (M8): vector kNN fused with FTS rank via RRF (semantic
 * weighted 2× — the embedding is the differentiator, FTS anchors keywords).
 */
export async function searchHybrid(
  engine: LLMEngine,
  db: Db,
  modelId: string,
  query: string,
  k = 20,
): Promise<ScoredOwner[]> {
  const [queryVector] = await engine.embed([query]);

  const allVectors = await db.all<{
    owner_type: EmbeddingRow['ownerType'];
    owner_id: number;
    vector: Uint8Array;
  }>(sql`SELECT owner_type, owner_id, vector FROM embeddings WHERE model = ${modelId}`);

  const vectorHits = knn(
    queryVector,
    allVectors.map((row) => ({
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      vector: row.vector,
    })),
    k,
  );

  const ftsHits = await ftsSearch(db, query, k);

  const fused = reciprocalRankFusion([
    { ids: vectorHits.map((hit) => ownerKey(hit.row.ownerType, hit.row.ownerId)), weight: 2 },
    // FTS on par with the vector channel: on-device embeddings are noisy for
    // short queries (llama.rn's older llama.cpp shifts the space, phase 9),
    // and keyword-anchored hits deserve equal footing.
    { ids: ftsHits.map((hit) => ownerKey(hit.ownerType, hit.ownerId)), weight: 2 },
  ]);

  const byKey = new Map(
    vectorHits.map((hit) => [ownerKey(hit.row.ownerType, hit.row.ownerId), hit]),
  );
  const owners = new Map(
    allVectors.map((row) => [ownerKey(row.owner_type, row.owner_id), row] as const),
  );

  return [...fused.entries()]
    .map(([key, fusedScore]) => {
      const [ownerType, ownerId] = key.split(':') as [EmbeddingRow['ownerType'], string];
      return {
        ownerType: owners.get(key)?.owner_type ?? ownerType,
        ownerId: Number(ownerId),
        vectorScore: byKey.get(key)?.score ?? 0,
        fusedScore,
      };
    })
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, k);
}

export interface FtsHit {
  ownerType: 'transcript_chunk' | 'note';
  ownerId: number;
}

/** FTS5 keyword search over chunks + notes; typed owner ids ranked by bm25.
 * Returns [] when the build has no FTS5 (expo-sqlite web, phase 11). */
export async function ftsSearch(db: Db, query: string, k = 20): Promise<FtsHit[]> {
  if (!(await hasFtsTables(db))) return [];
  const escaped = query.replace(/"/g, '""');
  const terms = escaped
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .map((term) => `"${term}"`)
    .join(' OR ');
  if (!terms) return [];
  const chunkRows = await db.all<{ owner_id: number; rank: number }>(
    sql`SELECT rowid AS owner_id, bm25(chunks_fts) AS rank FROM chunks_fts WHERE chunks_fts MATCH ${terms}
        ORDER BY rank LIMIT ${k}`,
  );
  const noteRows = await db.all<{ owner_id: number; rank: number }>(
    sql`SELECT rowid AS owner_id, bm25(notes_fts) AS rank FROM notes_fts WHERE notes_fts MATCH ${terms}
        ORDER BY rank LIMIT ${k}`,
  );
  return [
    ...chunkRows.map((row) => ({
      ownerType: 'transcript_chunk' as const,
      ownerId: row.owner_id,
      rank: row.rank,
    })),
    ...noteRows.map((row) => ({
      ownerType: 'note' as const,
      ownerId: row.owner_id,
      rank: row.rank,
    })),
  ]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, k)
    .map(({ ownerType, ownerId }) => ({ ownerType, ownerId }));
}
