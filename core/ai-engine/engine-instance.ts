import { Platform } from 'react-native';

import type { LLMEngine } from './types';

/**
 * Shared engine singleton (M4/M5/M10): exactly one chat model is loaded
 * device-wide. Platform-resolved: llama.rn (LlamaCppEngine) on native,
 * WebLLMEngine (WebGPU) in the browser. Both are created lazily — llama.rn
 * is native-only, WebLLM is web-only, so static imports would break the
 * other platform's bundle.
 */
let engine: LLMEngine | null = null;

export async function getEngine(): Promise<LLMEngine> {
  if (!engine) {
    if (Platform.OS === 'web') {
      const { WebLLMEngine } = await import('./web-llm-engine');
      engine = new WebLLMEngine();
    } else {
      const { LlamaCppEngine } = await import('./llama-cpp-engine');
      engine = new LlamaCppEngine();
    }
  }
  return engine;
}

/** Null before first use — for read-only status checks. */
export function peekEngine(): LLMEngine | null {
  return engine;
}
