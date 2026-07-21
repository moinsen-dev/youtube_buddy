import { initLlama, type LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';
import { z } from 'zod';

import { modelPath } from './model-manager';
import { parseJsonOutput } from './parse-json';
import type {
  EngineCapabilities,
  GenerateRequest,
  GenerateResult,
  LLMEngine,
  ModelSpec,
} from './types';

/**
 * LlamaCppEngine (M4): LLMEngine on top of llama.rn. Generation runs in
 * native json_schema mode (GBNF-enforced, ARCHITECTURE §3.3) plus a zod
 * validation with a single repair retry as safety net.
 */

const COMPLETION_DEFAULTS = {
  n_predict: 1024,
  temperature: 0.2,
  top_p: 0.9,
  stop: ['</s>', '<|end|>', '<|eot_id|>', '<|im_end|>'],
};

export class LlamaCppEngine implements LLMEngine {
  readonly id = 'llamacpp' as const;
  readonly capabilities: EngineCapabilities = { chat: true, embed: false, transcribe: false };

  private context: LlamaContext | null = null;
  private loadedSpec: ModelSpec | null = null;

  get loadedModelId(): string | null {
    return this.loadedSpec?.id ?? null;
  }

  async loadModel(spec: ModelSpec, onProgress?: (pct: number) => void): Promise<void> {
    const path = await modelPath(spec);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      throw new Error(`LlamaCppEngine: model '${spec.id}' is not downloaded yet`);
    }
    await this.loadModelFromPath(path, spec);
    onProgress?.(1);
  }

  async loadModelFromPath(path: string, spec: ModelSpec): Promise<void> {
    if (this.loadedSpec?.id === spec.id && this.context) return;
    await this.unloadModel();
    this.context = await initLlama({
      model: path,
      // 4096 covers all M4/M5 prompts (chunks ~800 chars) and halves the KV
      // cache vs 8192 — that RAM matters on the 4 GB device tier (and even
      // makes the Android emulator swap-thrash at 8192).
      n_ctx: Math.min(spec.contextLength, 4096),
      n_threads: 4,
    });
    this.loadedSpec = spec;
  }

  async unloadModel(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
    this.loadedSpec = null;
  }

  // --- Embedding backend (M8): separate lightweight context next to the
  // chat context — the chat model stays resident.

  private embeddingContext: LlamaContext | null = null;
  private embeddingSpec: ModelSpec | null = null;

  get loadedEmbeddingModelId(): string | null {
    return this.embeddingSpec?.id ?? null;
  }

  async loadEmbeddingModel(spec: ModelSpec): Promise<void> {
    if (this.embeddingSpec?.id === spec.id && this.embeddingContext) return;
    const path = await modelPath(spec);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      throw new Error(`LlamaCppEngine: embedding model '${spec.id}' is not downloaded yet`);
    }
    if (this.embeddingContext) {
      await this.embeddingContext.release();
      this.embeddingContext = null;
      this.embeddingSpec = null;
    }
    this.embeddingContext = await initLlama({
      model: path,
      n_ctx: spec.contextLength,
      embedding: true,
      // Sentence embedding (MiniLM) expects mean pooling + L2 normalization
      // (otherwise vectors collapse toward a uniform direction — verified in
      // phase 9).
      pooling_type: 'mean',
      embd_normalize: 2,
    });
    this.embeddingSpec = spec;
  }

  async unloadEmbeddingModel(): Promise<void> {
    if (this.embeddingContext) {
      await this.embeddingContext.release();
      this.embeddingContext = null;
    }
    this.embeddingSpec = null;
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    if (!this.context) {
      throw new Error('LlamaCppEngine: no model loaded (call loadModelFromPath first)');
    }
    const first = await this.complete(req.template.system, req.template.render(req.input), req);
    let parsed = parseJsonOutput(first.text, req.schema);
    let repaired = false;

    if (parsed === null) {
      repaired = true;
      const repairSystem = `${req.template.system}\nYou MUST answer with a single valid JSON object matching the required schema. No prose, no markdown fences.`;
      const second = await this.complete(repairSystem, req.template.render(req.input), req);
      parsed = parseJsonOutput(second.text, req.schema);
      if (parsed === null) {
        throw new Error(
          `generate: invalid JSON after repair retry (template '${req.template.id}')`,
        );
      }
      return {
        data: parsed,
        stats: {
          tokensPerSecond: second.tokensPerSecond,
          totalTokens: first.totalTokens + second.totalTokens,
          durationMs: first.durationMs + second.durationMs,
          repaired: true,
        },
      };
    }

    return {
      data: parsed,
      stats: {
        tokensPerSecond: first.tokensPerSecond,
        totalTokens: first.totalTokens,
        durationMs: first.durationMs,
        repaired,
      },
    };
  }

  private async complete<T>(
    system: string,
    prompt: string,
    req: GenerateRequest<T>,
  ): Promise<{ text: string; tokensPerSecond: number; totalTokens: number; durationMs: number }> {
    const context = this.context!;
    if (req.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (req.signal) {
      req.signal.addEventListener('abort', () => void context.stopCompletion(), { once: true });
    }

    const started = Date.now();
    const result = await context.completion(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        ...COMPLETION_DEFAULTS,
        response_format: {
          type: 'json_schema',
          json_schema: { strict: true, schema: z.toJSONSchema(req.schema) },
        },
      },
      req.onToken ? (data) => req.onToken?.(data.token) : undefined,
    );

    const durationMs = Date.now() - started;
    const totalTokens = result.timings?.predicted_n ?? 0;
    const tokensPerSecond =
      result.timings?.predicted_per_second ??
      (durationMs > 0 ? (totalTokens / durationMs) * 1000 : 0);
    return { text: result.text ?? '', tokensPerSecond, totalTokens, durationMs };
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.embeddingContext) {
      throw new Error('embed: no embedding model loaded (call loadEmbeddingModel first)');
    }
    const wrap = this.embeddingSpec?.embedSpecialTokens;
    const vectors: Float32Array[] = [];
    for (const text of texts) {
      const wrapped = wrap ? `${wrap.prefix}${text}${wrap.suffix}` : text;
      const result = await this.embeddingContext.embedding(wrapped);
      vectors.push(new Float32Array(result.embedding));
    }
    return vectors;
  }
}
