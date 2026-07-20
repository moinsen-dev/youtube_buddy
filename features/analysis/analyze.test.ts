import type { GenerateRequest, GenerateResult, LLMEngine } from '@/core/ai-engine/types';
import { analyzeTranscript, normalizeChapters, MAP_GROUP_SIZE } from './analyze';

/**
 * Pipeline tests (M5) with a fake engine: grouping, step order, progress,
 * chapter normalization and abort propagation — no real model involved.
 */

class FakeEngine implements LLMEngine {
  readonly id = 'llamacpp' as const;
  readonly capabilities = { chat: true, embed: false, transcribe: false };
  calls: { templateId: string; input: unknown }[] = [];
  abortAfterCalls = Infinity;
  private abortController?: AbortController;

  setAbort(controller: AbortController, afterCalls: number) {
    this.abortController = controller;
    this.abortAfterCalls = afterCalls;
  }

  async loadModel(): Promise<void> {}
  async unloadModel(): Promise<void> {}
  async embed(): Promise<Float32Array[]> {
    return [];
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    this.calls.push({ templateId: req.template.id, input: req.input });
    if (this.calls.length >= this.abortAfterCalls) this.abortController?.abort();
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const dataByTemplate: Record<string, unknown> = {
      'summarize.v1': {
        tldr: `Teil ${this.calls.length}`,
        keyPoints: [
          { text: 'a', sourceRefs: [{ startSec: 0 }] },
          { text: 'b', sourceRefs: [{ startSec: 1 }] },
          { text: 'c', sourceRefs: [{ startSec: 2 }] },
        ],
      },
      'summarize-reduce.v1': {
        tldr: 'Gesamt-TLDR',
        summary: 'Ausführliche Zusammenfassung.',
        keyPoints: [
          { text: 'a', sourceRefs: [{ startSec: 0 }] },
          { text: 'b', sourceRefs: [{ startSec: 100 }] },
          { text: 'c', sourceRefs: [{ startSec: 200 }] },
        ],
      },
      'chapters.v1': {
        chapters: [
          { startSec: 300, title: 'Spät' },
          { startSec: 0, title: 'Intro' },
          { startSec: 300, title: 'Duplikat' },
        ],
      },
      'triage.v1': { score: 4, reason: 'Dichtes Tutorial.', density: 'hoch', category: 'Tutorial' },
    };
    return {
      data: dataByTemplate[req.template.id] as T,
      stats: { tokensPerSecond: 20, totalTokens: 10, durationMs: 500, repaired: false },
    };
  }
}

function makeChunks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    startSec: i * 30,
    endSec: i * 30 + 25,
    text: `Abschnitt ${i}`,
  }));
}

describe('analyzeTranscript', () => {
  it('runs map/reduce + chapters + triage in order with progress', async () => {
    const engine = new FakeEngine();
    const progress: string[] = [];
    const result = await analyzeTranscript(
      engine,
      {
        title: 'Test',
        durationSec: 700,
        language: 'de',
        chunks: makeChunks(MAP_GROUP_SIZE * 2 + 4),
      },
      (p) => progress.push(`${p.step}:${p.index}/${p.total}`),
    );

    const templateOrder = engine.calls.map((c) => c.templateId);
    expect(templateOrder).toEqual([
      'summarize.v1',
      'summarize.v1',
      'summarize.v1',
      'summarize-reduce.v1',
      'chapters.v1',
      'triage.v1',
    ]);
    expect(progress).toEqual([
      'map:1/6',
      'map:2/6',
      'map:3/6',
      'reduce:4/6',
      'chapters:5/6',
      'triage:6/6',
    ]);

    // Reduce receives the partials with group-start timestamps.
    const reduceInput = engine.calls[3].input as { partials: { startSec: number }[] };
    expect(reduceInput.partials.map((p) => p.startSec)).toEqual([0, 240, 480]);

    expect(result.summary.tldr).toBe('Gesamt-TLDR');
    // Chapters normalized: sorted, duplicate startSec dropped.
    expect(result.chapters.chapters).toEqual([
      { startSec: 0, title: 'Intro' },
      { startSec: 300, title: 'Spät' },
    ]);
    expect(result.triage.score).toBe(4);
  });

  it('uses a single map call for short transcripts', async () => {
    const engine = new FakeEngine();
    await analyzeTranscript(engine, {
      title: 'Kurz',
      durationSec: 120,
      language: 'en',
      chunks: makeChunks(3),
    });
    expect(engine.calls.map((c) => c.templateId)).toEqual([
      'summarize.v1',
      'summarize-reduce.v1',
      'chapters.v1',
      'triage.v1',
    ]);
  });

  it('rejects with AbortError when the signal fires mid-pipeline', async () => {
    const engine = new FakeEngine();
    const controller = new AbortController();
    engine.setAbort(controller, 2);
    await expect(
      analyzeTranscript(
        engine,
        { title: 'Test', durationSec: 700, language: 'de', chunks: makeChunks(20) },
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws on empty transcripts', async () => {
    const engine = new FakeEngine();
    await expect(
      analyzeTranscript(engine, { title: 'X', durationSec: 10, language: 'de', chunks: [] }),
    ).rejects.toThrow('no transcript chunks');
  });
});

describe('normalizeChapters', () => {
  it('drops out-of-range chapters and falls back when nothing remains', () => {
    const normalized = normalizeChapters({ chapters: [{ startSec: 999, title: 'Jenseits' }] }, 600);
    expect(normalized.chapters).toEqual([{ startSec: 999, title: 'Jenseits' }]); // fallback: keep first
    const inRange = normalizeChapters(
      {
        chapters: [
          { startSec: 999, title: 'Jenseits' },
          { startSec: 10, title: 'Ok' },
        ],
      },
      600,
    );
    expect(inRange.chapters).toEqual([{ startSec: 10, title: 'Ok' }]);
  });
});
