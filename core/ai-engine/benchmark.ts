import goldenSetData from './golden-set.json';
import { summarizeV1, summarizeV1Schema, type SummarizeV1Output } from './prompts/summarize.v1';
import type { LLMEngine } from './types';

/**
 * Benchmark harness (M4): runs summarize.v1 over the golden set (10 real
 * transcripts, committed in this repo) and aggregates quality/performance
 * metrics for the model decision (ROADMAP Phase 4 exit).
 */

export interface GoldenSetItem {
  videoId: string;
  title: string;
  language: string;
  chunks: { startSec: number; endSec: number; text: string }[];
}

export interface BenchmarkItemResult {
  videoId: string;
  ok: boolean;
  repaired: boolean;
  tokensPerSecond: number;
  durationMs: number;
  error?: string;
}

export interface BenchmarkResult {
  items: BenchmarkItemResult[];
  validRate: number;
  repairedRate: number;
  avgTokensPerSecond: number;
  totalDurationMs: number;
  sample?: SummarizeV1Output;
}

const goldenSet = (goldenSetData as { items: GoldenSetItem[] }).items;

export async function runBenchmark(
  engine: LLMEngine,
  onItem?: (result: BenchmarkItemResult, index: number, total: number) => void,
): Promise<BenchmarkResult> {
  const items: BenchmarkItemResult[] = [];
  let sample: SummarizeV1Output | undefined;

  for (const [index, item] of goldenSet.entries()) {
    try {
      const result = await engine.generate({
        template: summarizeV1,
        input: { title: item.title, language: 'de', chunks: item.chunks },
        schema: summarizeV1Schema,
      });
      sample ??= result.data;
      items.push({
        videoId: item.videoId,
        ok: true,
        repaired: result.stats.repaired,
        tokensPerSecond: result.stats.tokensPerSecond,
        durationMs: result.stats.durationMs,
      });
    } catch (error) {
      items.push({
        videoId: item.videoId,
        ok: false,
        repaired: false,
        tokensPerSecond: 0,
        durationMs: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    onItem?.(items[items.length - 1], index, goldenSet.length);
  }

  const okItems = items.filter((item) => item.ok);
  return {
    items,
    validRate: items.length > 0 ? okItems.length / items.length : 0,
    repairedRate:
      okItems.length > 0 ? okItems.filter((i) => i.repaired).length / okItems.length : 0,
    avgTokensPerSecond:
      okItems.length > 0
        ? okItems.reduce((sum, item) => sum + item.tokensPerSecond, 0) / okItems.length
        : 0,
    totalDurationMs: items.reduce((sum, item) => sum + item.durationMs, 0),
    sample,
  };
}
