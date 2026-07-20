import type { LlamaCppEngine } from './llama-cpp-engine';

/**
 * Shared engine singleton (M4/M5): exactly one model is loaded device-wide.
 * Created lazily — llama.rn is native-only, so a static import would break
 * the web bundle. On web the instance is never created and callers that need
 * generation must surface a "model required" state.
 */
let engine: LlamaCppEngine | null = null;

export async function getEngine(): Promise<LlamaCppEngine> {
  if (!engine) {
    const { LlamaCppEngine } = await import('./llama-cpp-engine');
    engine = new LlamaCppEngine();
  }
  return engine;
}

/** Null on web / before first use — for read-only status checks. */
export function peekEngine(): LlamaCppEngine | null {
  return engine;
}
