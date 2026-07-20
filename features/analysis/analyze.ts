import type { LLMEngine } from '@/core/ai-engine/types';
import { summarizeV1, summarizeV1Schema } from '@/core/ai-engine/prompts/summarize.v1';
import {
  summarizeReduceV1,
  summarizeReduceV1Schema,
  type SummarizeReduceV1Output,
} from '@/core/ai-engine/prompts/summarize-reduce.v1';
import {
  chaptersV1,
  chaptersV1Schema,
  type ChaptersV1Output,
} from '@/core/ai-engine/prompts/chapters.v1';
import { triageV1, triageV1Schema, type TriageV1Output } from '@/core/ai-engine/prompts/triage.v1';

/**
 * Analysis pipeline (M5, ARCHITECTURE §5.2): chunk map/reduce over the
 * transcript, then chapters + triage derived from the partials. Every output
 * is schema-enforced by the engine (json_schema) and zod-validated.
 */

export interface AnalysisInput {
  title: string;
  durationSec: number;
  language: 'de' | 'en';
  chunks: { startSec: number; endSec: number; text: string }[];
}

export interface AnalysisResult {
  summary: SummarizeReduceV1Output;
  chapters: ChaptersV1Output;
  triage: TriageV1Output;
}

/** Chunks per map call — ≈1600 prompt tokens at ~800 chars each (n_ctx 4096). */
export const MAP_GROUP_SIZE = 8;

export type AnalysisStep = 'map' | 'reduce' | 'chapters' | 'triage';

export interface AnalysisProgress {
  step: AnalysisStep;
  /** 1-based index of the current step within all steps. */
  index: number;
  total: number;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/** Sorts ascending, drops out-of-range and duplicate chapter starts. */
export function normalizeChapters(
  chapters: ChaptersV1Output,
  durationSec: number,
): ChaptersV1Output {
  const seen = new Set<number>();
  const cleaned = [...chapters.chapters]
    .filter(
      (chapter) => chapter.startSec >= 0 && (durationSec <= 0 || chapter.startSec <= durationSec),
    )
    .sort((a, b) => a.startSec - b.startSec)
    .filter((chapter) => {
      const key = Math.round(chapter.startSec);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { chapters: cleaned.length > 0 ? cleaned : chapters.chapters.slice(0, 1) };
}

export async function analyzeTranscript(
  engine: LLMEngine,
  input: AnalysisInput,
  onProgress?: (progress: AnalysisProgress) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  if (input.chunks.length === 0) {
    throw new Error('analyzeTranscript: no transcript chunks');
  }

  const groups: AnalysisInput['chunks'][] = [];
  for (let i = 0; i < input.chunks.length; i += MAP_GROUP_SIZE) {
    groups.push(input.chunks.slice(i, i + MAP_GROUP_SIZE));
  }
  const total = groups.length + 3; // + reduce, chapters, triage
  let step = 0;
  const report = (s: AnalysisStep) => {
    step += 1;
    onProgress?.({ step: s, index: step, total });
  };

  // Map: partial TL;DR per chunk group (source timestamp = group start).
  const partials: { startSec: number; tldr: string }[] = [];
  for (const group of groups) {
    throwIfAborted(signal);
    report('map');
    const result = await engine.generate({
      template: summarizeV1,
      input: { title: input.title, language: input.language, chunks: group },
      schema: summarizeV1Schema,
      signal,
    });
    partials.push({ startSec: group[0].startSec, tldr: result.data.tldr });
  }

  throwIfAborted(signal);
  report('reduce');
  const summaryResult = await engine.generate({
    template: summarizeReduceV1,
    input: { title: input.title, language: input.language, partials },
    schema: summarizeReduceV1Schema,
    signal,
  });

  throwIfAborted(signal);
  report('chapters');
  const chaptersResult = await engine.generate({
    template: chaptersV1,
    input: { title: input.title, language: input.language, partials },
    schema: chaptersV1Schema,
    signal,
  });

  throwIfAborted(signal);
  report('triage');
  const triageResult = await engine.generate({
    template: triageV1,
    input: {
      title: input.title,
      durationSec: input.durationSec,
      tldr: summaryResult.data.tldr,
      language: input.language,
    },
    schema: triageV1Schema,
    signal,
  });

  return {
    summary: summaryResult.data,
    chapters: normalizeChapters(chaptersResult.data, input.durationSec),
    triage: triageResult.data,
  };
}
