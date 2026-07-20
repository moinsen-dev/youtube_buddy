import type { LLMEngine } from '@/core/ai-engine/types';
import { triageV1, triageV1Schema, type TriageV1Output } from '@/core/ai-engine/prompts/triage.v1';
import type { Db } from '@/core/db/repositories';
import { upsertAnalysis } from '@/core/db/repositories';
import { defaultLocale } from '@/core/i18n/strings';
import { ensureTranscript } from '@/features/transcripts/ensure-transcript';

/**
 * Triage batch (M5, ROADMAP Phase 5 exit): runs triage.v1 over the
 * Watch-Later queue — one cheap call per video (title + duration + opening
 * transcript), persisting each result as analyses(kind='triage').
 */

export interface TriageBatchVideo {
  id: string;
  title: string;
  durationSec: number | null;
}

export interface TriageBatchItemResult {
  videoId: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export interface TriageBatchResult {
  results: TriageBatchItemResult[];
  done: number;
  failed: number;
}

/** Raw context for the triage prompt when no summary exists yet. */
function triageContext(chunks: { startSec: number; text: string }[]): string {
  return chunks
    .slice(0, 2)
    .map((chunk) => chunk.text)
    .join(' ')
    .slice(0, 1200);
}

export async function runTriageBatch(
  engine: LLMEngine,
  db: Db,
  modelId: string,
  videos: TriageBatchVideo[],
  onProgress?: (done: number, total: number, currentTitle: string) => void,
  signal?: AbortSignal,
): Promise<TriageBatchResult> {
  const results: TriageBatchItemResult[] = [];
  const total = videos.length;

  for (const [index, video] of videos.entries()) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onProgress?.(index, total, video.title);
    try {
      const transcript = await ensureTranscript(db, video.id);
      if (transcript.status !== 'ok') {
        results.push({
          videoId: video.id,
          ok: false,
          skipped: true,
          error: transcript.status === 'no-captions' ? 'no-captions' : transcript.message,
        });
        continue;
      }
      const result = await engine.generate<TriageV1Output>({
        template: triageV1,
        input: {
          title: video.title,
          durationSec: video.durationSec ?? 0,
          tldr: triageContext(transcript.chunks),
          language: defaultLocale,
        },
        schema: triageV1Schema,
        signal,
      });
      await upsertAnalysis(db, {
        videoId: video.id,
        kind: 'triage',
        model: modelId,
        promptVersion: 'triage.v1',
        payload: JSON.stringify(result.data),
        createdAt: Date.now(),
      });
      results.push({ videoId: video.id, ok: true });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      results.push({
        videoId: video.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  onProgress?.(total, total, '');
  return {
    results,
    done: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok && !r.skipped).length,
  };
}
