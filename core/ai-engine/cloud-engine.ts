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
 * CloudEngine (Pro-Tier, ADR PRD §7.6): LLMEngine on top of the EU Cloud
 * Function `analyze` (Gemini with server-enforced responseSchema). Opt-in
 * only — when disabled, this engine is never constructed and no traffic
 * leaves the device. Embedding intentionally stays on-device (M8).
 */

export interface CloudEngineOptions {
  /** Full https URL of the analyze function (per environment). */
  endpointUrl: string;
  /** Fresh Firebase ID token per call. */
  getIdToken: () => Promise<string>;
  fetchFn?: typeof fetch;
}

interface AnalyzeResponse {
  text?: string;
  stats?: { model?: string; durationMs?: number; totalTokens?: number | null };
  error?: string;
}

export class CloudEngine implements LLMEngine {
  readonly id = 'cloud' as const;
  readonly capabilities: EngineCapabilities = { chat: true, embed: false, transcribe: false };

  private readonly options: CloudEngineOptions;
  private readonly fetchFn: typeof fetch;

  constructor(options: CloudEngineOptions) {
    this.options = options;
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
  }

  /** No local model — present for interface compatibility (no-op). */
  async loadModel(_spec: ModelSpec): Promise<void> {}

  async unloadModel(): Promise<void> {}

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const started = Date.now();
    const token = await this.options.getIdToken();
    const response = await this.fetchFn(this.options.endpointUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: req.template.system,
        prompt: req.template.render(req.input),
        schema: z.toJSONSchema(req.schema),
      }),
      signal: req.signal,
    });
    const body = (await response.json()) as AnalyzeResponse;
    if (!response.ok || !body.text) {
      throw new Error(
        `CloudEngine: analyze failed (${response.status}): ${body.error ?? 'no text in response'}`,
      );
    }
    const parsed = parseJsonOutput(body.text, req.schema);
    if (parsed === null) {
      throw new Error(
        `CloudEngine: invalid JSON despite server schema (template '${req.template.id}')`,
      );
    }
    return {
      data: parsed,
      stats: {
        tokensPerSecond: 0, // not streamed/measured for cloud calls
        totalTokens: body.stats?.totalTokens ?? 0,
        durationMs: body.stats?.durationMs ?? Date.now() - started,
        repaired: false,
      },
    };
  }

  async embed(_texts: string[]): Promise<Float32Array[]> {
    throw new Error('CloudEngine: embedding stays on-device (use the local engine)');
  }
}
