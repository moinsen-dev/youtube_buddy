import { CloudEngine } from '@/core/ai-engine/cloud-engine';
import { getEngine, peekEngine } from '@/core/ai-engine/engine-instance';
import type { LLMEngine } from '@/core/ai-engine/types';
import { getSetting } from '@/core/db/repositories';
import type { Db } from '@/core/db/repositories';

import { getFirebaseConfig, ProSession, createSecureStorage } from './pro-session';

/**
 * Engine selection for analyses (ADR PRD §7.6): the CloudEngine is used only
 * when the user opted in AND a Firebase session exists AND a local model is
 * not explicitly preferred. Free/local-only path unchanged: the llama.cpp
 * engine with its loaded model. No feature forks — both speak LLMEngine.
 */

export const CLOUD_OPT_IN_KEY = 'cloud_analysis_opt_in';
export const CLOUD_MODEL_LABEL = 'gemini-2.5-flash (cloud)';

export interface ResolvedEngine {
  engine: LLMEngine;
  /** Persisted into analyses.model — the audit trail for local vs cloud. */
  modelLabel: string;
  isCloud: boolean;
}

let cachedSession: ProSession | null = null;

/** Shared ProSession instance (SecureStore-backed, lazily created). */
export async function getProSession(): Promise<ProSession | null> {
  const config = getFirebaseConfig();
  if (!config) return null;
  if (!cachedSession) {
    cachedSession = new ProSession(config, await createSecureStorage());
  }
  return cachedSession;
}

/**
 * Resolves the engine for analysis runs. Returns null with a reason when
 * generation is impossible (no local model and no usable cloud path).
 */
export async function resolveAnalysisEngine(db: Db): Promise<ResolvedEngine | { error: string }> {
  const cloudOptIn = (await getSetting(db, CLOUD_OPT_IN_KEY)) === 'true';
  if (cloudOptIn) {
    const config = getFirebaseConfig();
    const session = await getProSession();
    if (config && session && (await session.restore())) {
      return {
        engine: new CloudEngine({
          endpointUrl: config.analyzeUrl,
          getIdToken: () => session.getIdToken(),
        }),
        modelLabel: CLOUD_MODEL_LABEL,
        isCloud: true,
      };
    }
    // Opt-in without a session: fall through to local with a clear note.
  }

  const loadedId = peekEngine()?.loadedModelId;
  if (!loadedId) {
    return {
      error:
        'Kein Modell geladen — erst im Mehr-Tab ein Modell laden (oder Cloud-Analyse mit Firebase-Verbindung aktivieren).',
    };
  }
  return { engine: await getEngine(), modelLabel: loadedId, isCloud: false };
}
