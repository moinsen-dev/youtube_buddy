import { useCallback, useEffect, useState } from 'react';

import { getEngine, peekEngine } from '@/core/ai-engine/engine-instance';
import { MODEL_REGISTRY } from '@/core/ai-engine/model-registry';
import type { ChaptersV1Output } from '@/core/ai-engine/prompts/chapters.v1';
import type { SummarizeReduceV1Output } from '@/core/ai-engine/prompts/summarize-reduce.v1';
import type { TriageV1Output } from '@/core/ai-engine/prompts/triage.v1';
import { getDb } from '@/core/db';
import { listAnalyses, upsertAnalysis } from '@/core/db/repositories';
import { defaultLocale } from '@/core/i18n/strings';
import { ensureTranscript } from '@/features/transcripts/ensure-transcript';

import { analyzeTranscript, type AnalysisProgress } from './analyze';

/**
 * Analysis hook (M5): loads cached analyses for a video, runs the
 * map/reduce pipeline on demand and persists the results (analyses table).
 * Requires a loaded model (Mehr tab) and a cached transcript.
 */

export type AnalysisStatus = 'idle' | 'running' | 'ready' | 'error';

export interface AnalysisState {
  status: AnalysisStatus;
  progress: AnalysisProgress | null;
  summary: SummarizeReduceV1Output | null;
  chapters: ChaptersV1Output | null;
  triage: TriageV1Output | null;
  error: string | null;
}

export function useAnalysis(videoId: string) {
  const [state, setState] = useState<AnalysisState>({
    status: 'idle',
    progress: null,
    summary: null,
    chapters: null,
    triage: null,
    error: null,
  });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      if (!db) return; // web: no local DB yet (phase 11)
      const rows = await listAnalyses(db, videoId);
      if (cancelled || rows.length === 0) return;
      const byKind = new Map(rows.map((row) => [row.kind, row.payload]));
      setState((current) => ({
        ...current,
        status: 'ready',
        summary: byKind.has('summary') ? JSON.parse(byKind.get('summary')!) : null,
        chapters: byKind.has('chapters') ? JSON.parse(byKind.get('chapters')!) : null,
        triage: byKind.has('triage') ? JSON.parse(byKind.get('triage')!) : null,
      }));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const start = useCallback(
    async (meta: { title: string; durationSec: number }) => {
      const loadedId = peekEngine()?.loadedModelId;
      if (!loadedId) {
        setState((current) => ({
          ...current,
          status: 'error',
          error: 'Kein Modell geladen — erst im Mehr-Tab ein Modell laden.',
        }));
        return;
      }
      const controller = new AbortController();
      setAbortController(controller);
      setState((current) => ({ ...current, status: 'running', progress: null, error: null }));
      try {
        const db = await getDb();
        if (!db) throw new Error('Keine lokale Datenbank (Web) — Analyse läuft nur nativ.');
        const transcript = await ensureTranscript(db, videoId);
        if (transcript.status !== 'ok') {
          throw new Error(
            transcript.status === 'no-captions'
              ? 'Kein Transkript verfügbar — dieses Video hat keine Untertitel.'
              : `Transkript-Fehler: ${transcript.message}`,
          );
        }
        const engine = await getEngine();
        const result = await analyzeTranscript(
          engine,
          {
            title: meta.title,
            durationSec: meta.durationSec,
            language: defaultLocale,
            chunks: transcript.chunks,
          },
          (progress) => setState((current) => ({ ...current, progress })),
          controller.signal,
        );
        const now = Date.now();
        const spec = MODEL_REGISTRY.find((entry) => entry.id === loadedId);
        const model = spec?.id ?? loadedId;
        await upsertAnalysis(db, {
          videoId,
          kind: 'summary',
          model,
          promptVersion: 'summarize-reduce.v1',
          payload: JSON.stringify(result.summary),
          createdAt: now,
        });
        await upsertAnalysis(db, {
          videoId,
          kind: 'chapters',
          model,
          promptVersion: 'chapters.v1',
          payload: JSON.stringify(result.chapters),
          createdAt: now,
        });
        await upsertAnalysis(db, {
          videoId,
          kind: 'triage',
          model,
          promptVersion: 'triage.v1',
          payload: JSON.stringify(result.triage),
          createdAt: now,
        });
        setState((current) => ({
          ...current,
          status: 'ready',
          progress: null,
          summary: result.summary,
          chapters: result.chapters,
          triage: result.triage,
        }));
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        setState((current) => ({
          ...current,
          status: 'error',
          progress: null,
          error: aborted
            ? 'Analyse abgebrochen'
            : error instanceof Error
              ? error.message
              : String(error),
        }));
      } finally {
        setAbortController(null);
      }
    },
    [videoId],
  );

  const abort = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const engineReady = peekEngine()?.loadedModelId != null;
  const modelName = engineReady
    ? (MODEL_REGISTRY.find((entry) => entry.id === peekEngine()!.loadedModelId)?.name ?? null)
    : null;

  return { ...state, engineReady, modelName, start, abort };
}
