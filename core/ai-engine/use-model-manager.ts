import * as Device from 'expo-device';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resetDb } from '@/core/db';
import { runBenchmark, type BenchmarkResult } from './benchmark';
import { getEngine, peekEngine } from './engine-instance';
import { downloadModel, freeStorageBytes, isModelDownloaded } from './model-manager';
import { MODEL_REGISTRY, recommendedModel } from './model-registry';
import { pingV1, pingV1Schema, type PingV1Output } from './prompts/ping.v1';
import type { ModelSpec } from './types';

/**
 * Model management hook (M4): per-model state machine, download with
 * progress, load/unload into the shared engine (engine-instance), plus a
 * smoke test (ping.v1).
 */

export type ModelStatus = 'missing' | 'downloading' | 'downloaded' | 'loaded' | 'error';

export interface ModelEntry {
  spec: ModelSpec;
  status: ModelStatus;
  /** 0..1 while downloading. */
  progress: number;
  error?: string;
}

export interface SmokeResult {
  output: PingV1Output;
  tokensPerSecond: number;
  durationMs: number;
  repaired: boolean;
}

export function useModelManager() {
  const [entries, setEntries] = useState<ModelEntry[]>([]);
  const [freeBytes, setFreeBytes] = useState(0);
  const [smoke, setSmoke] = useState<{ running: boolean; result?: SmokeResult; error?: string }>({
    running: false,
  });
  const smokeAbortRef = useRef<AbortController | null>(null);

  const recommended = useMemo(() => recommendedModel(Device.totalMemory ?? 0), []);

  const refresh = useCallback(async () => {
    setFreeBytes(await freeStorageBytes());
    const next = await Promise.all(
      MODEL_REGISTRY.map(async (spec) => {
        const downloaded = await isModelDownloaded(spec);
        const loaded = peekEngine()?.loadedModelId === spec.id;
        return {
          spec,
          status: (loaded ? 'loaded' : downloaded ? 'downloaded' : 'missing') as ModelStatus,
          progress: downloaded ? 1 : 0,
        };
      }),
    );
    setEntries((current) =>
      next.map((entry) => {
        const previous = current.find((item) => item.spec.id === entry.spec.id);
        return previous?.status === 'downloading' ? previous : entry;
      }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const patchEntry = useCallback((id: string, patch: Partial<ModelEntry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.spec.id === id ? { ...entry, ...patch } : entry)),
    );
  }, []);

  const download = useCallback(
    async (spec: ModelSpec) => {
      patchEntry(spec.id, { status: 'downloading', progress: 0, error: undefined });
      const result = await downloadModel(spec, (pct) => patchEntry(spec.id, { progress: pct }));
      if (result.status === 'ok') {
        patchEntry(spec.id, { status: 'downloaded', progress: 1 });
      } else {
        patchEntry(spec.id, {
          status: 'error',
          error: result.status === 'not-enough-space' ? 'Speicher voll' : JSON.stringify(result),
        });
      }
    },
    [patchEntry],
  );

  const load = useCallback(
    async (spec: ModelSpec) => {
      patchEntry(spec.id, { error: undefined });
      try {
        await (await getEngine()).loadModel(spec);
        // Android: initLlama invalidates the sqlite JSI handle (prepareSync
        // NPE) — force a fresh handle opened after the load.
        resetDb();
        await refresh();
      } catch (error) {
        patchEntry(spec.id, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [patchEntry, refresh],
  );

  const unload = useCallback(async () => {
    const current = peekEngine();
    if (current) await current.unloadModel();
    await refresh();
  }, [refresh]);

  const remove = useCallback(
    async (spec: ModelSpec) => {
      const { deleteModel } = await import('./model-manager');
      const current = peekEngine();
      if (current?.loadedModelId === spec.id) {
        await current.unloadModel();
      }
      await deleteModel(spec);
      await refresh();
    },
    [refresh],
  );

  const runSmokeTest = useCallback(async () => {
    const controller = new AbortController();
    smokeAbortRef.current = controller;
    setSmoke({ running: true });
    try {
      const result = await (
        await getEngine()
      ).generate({
        template: pingV1,
        input: {},
        schema: pingV1Schema,
        signal: controller.signal,
      });
      setSmoke({
        running: false,
        result: {
          output: result.data,
          tokensPerSecond: result.stats.tokensPerSecond,
          durationMs: result.stats.durationMs,
          repaired: result.stats.repaired,
        },
      });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      setSmoke({
        running: false,
        error: aborted ? 'abgebrochen' : error instanceof Error ? error.message : String(error),
      });
    } finally {
      smokeAbortRef.current = null;
    }
  }, []);

  const abortSmokeTest = useCallback(() => {
    smokeAbortRef.current?.abort();
  }, []);

  const [bench, setBench] = useState<{
    running: boolean;
    progress?: string;
    result?: BenchmarkResult;
    error?: string;
  }>({ running: false });

  const runBench = useCallback(async () => {
    setBench({ running: true, progress: '0/10' });
    try {
      const result = await runBenchmark(await getEngine(), (item, index, total) => {
        setBench((current) => ({ ...current, progress: `${index + 1}/${total}` }));
        console.log(
          `[benchmark] ${index + 1}/${total} ${item.videoId} ok=${item.ok} repaired=${item.repaired} ${item.tokensPerSecond.toFixed(1)} tok/s ${(item.durationMs / 1000).toFixed(1)}s${item.error ? ` err=${item.error}` : ''}`,
        );
      });
      console.log(
        `[benchmark] DONE valid=${(result.validRate * 100).toFixed(0)}% repaired=${(result.repairedRate * 100).toFixed(0)}% avg=${result.avgTokensPerSecond.toFixed(1)} tok/s total=${(result.totalDurationMs / 1000).toFixed(0)}s sample="${result.sample?.tldr?.slice(0, 120)}"`,
      );
      setBench({ running: false, result });
    } catch (error) {
      setBench({ running: false, error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  return {
    entries,
    freeBytes,
    recommended,
    smoke,
    bench,
    download,
    load,
    unload,
    remove,
    runSmokeTest,
    abortSmokeTest,
    runBench,
    refresh,
  };
}
