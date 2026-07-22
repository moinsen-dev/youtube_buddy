import { z } from 'zod';

import { parseJsonOutput } from './parse-json';
import type {
  EngineCapabilities,
  GenerateRequest,
  GenerateResult,
  LLMEngine,
  ModelSpec,
} from './types';

/**
 * WebLLMEngine (M10, phase 11): LLMEngine fully in the browser — chat via
 * WebLLM (WebGPU, model cached by the browser), embeddings via
 * transformers.js (ONNX, mean-pooled + L2-normalized like native).
 * Loaded lazily and only when WebGPU exists (core/platform/webgpu gates
 * the UX; without WebGPU the app is the read-only mode).
 *
 * The embedding contract matches the native engine: mean pooling + L2
 * normalization over the SAME model family (paraphrase-multilingual-
 * MiniLM-L12-v2), so vectors are comparable in spirit — though the
 * embeddings table is per-device anyway (no cross-device index in v1).
 */

/** Registry chat-spec id → WebLLM prebuilt model id. */
const WEBLLM_MODEL_IDS: Record<string, string> = {
  'qwen3-4b-instruct-q4': 'Qwen3-4B-q4f16_1-MLC',
  'gemma-3-4b-it-q4': 'gemma-3-4b-it-q4f16_1-MLC',
  'llama-32-3b-instruct-q4': 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
};

/** Registry embedding-spec id → transformers.js (ONNX) model. */
const EMBEDDING_MODEL_IDS: Record<string, string> = {
  'paraphrase-multilingual-minilm-q4':
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
};

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatEngine {
  chat: {
    completions: {
      create: (req: {
        messages: ChatCompletionMessage[];
        temperature?: number;
        response_format?: { type: string; schema?: string };
      }) => Promise<{
        choices: { message: { content: string | null } }[];
        usage?: { total_tokens?: number };
      }>;
    };
  };
  unload?: () => Promise<void>;
}

interface EmbeddingPipeline {
  (
    text: string,
    options: { pooling: string; normalize: boolean },
  ): Promise<{
    data: Float32Array | number[];
  }>;
}

export class WebLLMEngine implements LLMEngine {
  readonly id = 'webllm' as const;
  readonly capabilities: EngineCapabilities = { chat: true, embed: true, transcribe: false };

  private chatEngine: ChatEngine | null = null;
  private loadedSpec: ModelSpec | null = null;
  private embedder: EmbeddingPipeline | null = null;
  private embeddingSpec: ModelSpec | null = null;

  get loadedModelId(): string | null {
    return this.loadedSpec?.id ?? null;
  }

  get loadedEmbeddingModelId(): string | null {
    return this.embeddingSpec?.id ?? null;
  }

  async loadModel(spec: ModelSpec, onProgress?: (pct: number) => void): Promise<void> {
    if (this.loadedSpec?.id === spec.id && this.chatEngine) {
      onProgress?.(1);
      return;
    }
    const modelId = WEBLLM_MODEL_IDS[spec.id] ?? spec.id;
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    this.chatEngine = (await CreateMLCEngine(modelId, {
      initProgressCallback: (report: { progress: number }) => onProgress?.(report.progress),
    })) as unknown as ChatEngine;
    this.loadedSpec = spec;
  }

  async unloadModel(): Promise<void> {
    await this.chatEngine?.unload?.();
    this.chatEngine = null;
    this.loadedSpec = null;
  }

  async loadEmbeddingModel(spec: ModelSpec): Promise<void> {
    if (this.embeddingSpec?.id === spec.id && this.embedder) return;
    const modelId = EMBEDDING_MODEL_IDS[spec.id] ?? spec.id;
    const { pipeline } = await import('@xenova/transformers');
    // quantized: false → onnx/model.onnx (the repo has no
    // model_quantized.onnx; the fp32 base model is the compatible default —
    // qint8 variants are arch-specific and can be added per-platform later).
    this.embedder = (await pipeline('feature-extraction', modelId, {
      quantized: false,
    })) as unknown as EmbeddingPipeline;
    this.embeddingSpec = spec;
  }

  async unloadEmbeddingModel(): Promise<void> {
    this.embedder = null;
    this.embeddingSpec = null;
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    if (!this.chatEngine) {
      throw new Error('WebLLMEngine: no model loaded (call loadModel first)');
    }
    const started = Date.now();
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: req.template.system },
      { role: 'user', content: req.template.render(req.input) },
    ];
    const jsonSchema = JSON.stringify(z.toJSONSchema(req.schema));

    const first = await this.complete(messages, jsonSchema);
    let parsed = parseJsonOutput(first.text, req.schema);
    if (parsed === null) {
      const repair: ChatCompletionMessage[] = [
        {
          role: 'system',
          content: `${req.template.system}\nYou MUST answer with a single valid JSON object matching the required schema. No prose, no markdown fences.`,
        },
        { role: 'user', content: req.template.render(req.input) },
      ];
      const second = await this.complete(repair, jsonSchema);
      parsed = parseJsonOutput(second.text, req.schema);
      if (parsed === null) {
        throw new Error(
          `WebLLMEngine: invalid JSON after repair retry (template '${req.template.id}')`,
        );
      }
      return {
        data: parsed,
        stats: {
          tokensPerSecond: 0,
          totalTokens: first.totalTokens + second.totalTokens,
          durationMs: Date.now() - started,
          repaired: true,
        },
      };
    }
    return {
      data: parsed,
      stats: {
        tokensPerSecond: 0,
        totalTokens: first.totalTokens,
        durationMs: Date.now() - started,
        repaired: false,
      },
    };
  }

  private async complete(
    messages: ChatCompletionMessage[],
    jsonSchema: string,
  ): Promise<{ text: string; totalTokens: number }> {
    const reply = await this.chatEngine!.chat.completions.create({
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object', schema: jsonSchema },
    });
    return {
      text: reply.choices[0]?.message.content ?? '',
      totalTokens: reply.usage?.total_tokens ?? 0,
    };
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.embedder) {
      throw new Error('WebLLMEngine: no embedding model loaded (call loadEmbeddingModel first)');
    }
    const vectors: Float32Array[] = [];
    for (const text of texts) {
      const result = await this.embedder(text, { pooling: 'mean', normalize: true });
      vectors.push(new Float32Array(result.data));
    }
    return vectors;
  }
}
