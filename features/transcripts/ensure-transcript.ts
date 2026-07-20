import type { Db, TranscriptChunkRow } from '@/core/db/repositories';
import { getTranscriptMeta, listTranscriptChunks, saveTranscript } from '@/core/db/repositories';

import { fetchTranscriptCues } from './captions-source';
import { chunkCues } from './chunker';

/**
 * Non-hook variant of the transcript loader (M5 batch/analysis): cache-first,
 * otherwise caption extraction + persist (same rules as use-transcript).
 */
export type EnsureTranscriptResult =
  | { status: 'ok'; chunks: TranscriptChunkRow[] }
  | { status: 'no-captions' }
  | { status: 'error'; message: string };

export async function ensureTranscript(db: Db, videoId: string): Promise<EnsureTranscriptResult> {
  try {
    const cached = await getTranscriptMeta(db, videoId);
    if (cached) {
      const chunks = await listTranscriptChunks(db, videoId);
      return chunks.length > 0 ? { status: 'ok', chunks } : { status: 'no-captions' };
    }
    const outcome = await fetchTranscriptCues(videoId);
    if (outcome.status === 'ok') {
      const chunks = chunkCues(outcome.cues);
      await saveTranscript(
        db,
        { videoId, lang: outcome.lang, source: 'captions', fetchedAt: Date.now() },
        chunks,
      );
      return { status: 'ok', chunks: await listTranscriptChunks(db, videoId) };
    }
    if (outcome.status === 'no-captions') {
      await saveTranscript(
        db,
        { videoId, lang: null, source: 'captions', fetchedAt: Date.now() },
        [],
      );
      return { status: 'no-captions' };
    }
    return { status: 'error', message: outcome.message };
  } catch (cause) {
    return { status: 'error', message: cause instanceof Error ? cause.message : String(cause) };
  }
}
