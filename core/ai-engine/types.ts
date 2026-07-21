import type { z } from 'zod';

/**
 * LLMEngine abstraction (M4, ARCHITECTURE §3.1): features only know this
 * interface; backends are LlamaCppEngine (native) and later WebLLMEngine
 * (web, phase 11).
 */

export type EngineId = 'llamacpp' | 'webllm' | 'cloud';

export interface EngineCapabilities {
  chat: boolean;
  embed: boolean;
  transcribe: boolean;
}

export interface ModelSpec {
  /** Registry id, e.g. 'qwen3-4b-instruct-q4'. */
  id: string;
  /** Display name for the management UI. */
  name: string;
  /** Hugging Face download URL (GGUF). */
  url: string;
  /** Expected file size in bytes (for progress + storage checks). */
  sizeBytes: number;
  /** SHA-256 of the GGUF file; empty until pinned after first download. */
  sha256: string;
  /** Context window in tokens. */
  contextLength: number;
  /** Minimum device RAM in bytes needed to run comfortably. */
  minRamBytes: number;
  /**
   * Special-token wrap for embedding inputs (M8). llama.rn tokenizes
   * embedding prompts without special tokens (its loadPrompt only adds BOS
   * when the vocab asks for it, and never SEP), while llama.cpp's reference
   * embedding path wraps every input as `<s>…</s>` for this tokenizer.
   * Without the wrap, short queries land in a distorted region of the
   * embedding space — verified in phase 9 (query↔doc ranking collapsed).
   */
  embedSpecialTokens?: { prefix: string; suffix: string };
  /** Free-form note for the UI (e.g. recommendation). */
  note?: string;
}

export interface PromptTemplate {
  /** Versioned template id, e.g. 'summarize.v1'. */
  id: string;
  /** System prompt (language-aware, ARCHITECTURE §3.3). */
  system: string;
  /** Renders the user prompt from the template input. */
  render: (input: unknown) => string;
}

export interface GenerateRequest<T> {
  template: PromptTemplate;
  input: unknown;
  /** Enforced JSON output schema (GBNF/JSON mode + zod validation). */
  schema: z.ZodType<T>;
  /** Streaming callback for UI progress. */
  onToken?: (token: string) => void;
  /** Cancellation signal (user abort). */
  signal?: AbortSignal;
}

export interface GenerateStats {
  tokensPerSecond: number;
  totalTokens: number;
  durationMs: number;
  /** True when the output needed a repair retry (ARCHITECTURE §3.3). */
  repaired: boolean;
}

export interface GenerateResult<T> {
  data: T;
  stats: GenerateStats;
}

export interface TranscriptResult {
  text: string;
}

export interface LLMEngine {
  readonly id: EngineId;
  readonly capabilities: EngineCapabilities;

  loadModel(spec: ModelSpec, onProgress?: (pct: number) => void): Promise<void>;
  unloadModel(): Promise<void>;

  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
  embed(texts: string[]): Promise<Float32Array[]>;
  transcribe?(audioPath: string): Promise<TranscriptResult>;
}
