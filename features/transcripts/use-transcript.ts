import { useCallback, useEffect, useState } from 'react';

import { getDb } from '@/core/db';
import {
  getTranscriptMeta,
  listTranscriptChunks,
  saveTranscript,
  type TranscriptChunkRow,
} from '@/core/db/repositories';
import { chunkCues } from './chunker';
import { fetchTranscriptCues } from './captions-source';

/**
 * Loads a video's transcript: cache-first (local DB), otherwise via the
 * caption extraction adapter (PRD §7.1 — only for videos the user actively
 * opened/watches). Chunks are cached once per video.
 */
export type TranscriptStatus = 'loading' | 'ready' | 'no-captions' | 'error' | 'unavailable';

export function useTranscript(videoId: string) {
  const [status, setStatus] = useState<TranscriptStatus>('loading');
  const [chunks, setChunks] = useState<TranscriptChunkRow[]>([]);
  const [lang, setLang] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setError(null);
      try {
        const db = await getDb();
        if (db) {
          const cached = await getTranscriptMeta(db, videoId);
          if (cached) {
            if (cancelled) return;
            setChunks(await listTranscriptChunks(db, videoId));
            setLang(cached.lang);
            setStatus(cached.lang ? 'ready' : 'no-captions');
            return;
          }
        }
        const outcome = await fetchTranscriptCues(videoId);
        if (cancelled) return;
        if (outcome.status === 'ok') {
          const chunks = chunkCues(outcome.cues);
          if (db) {
            await saveTranscript(
              db,
              { videoId, lang: outcome.lang, source: 'captions', fetchedAt: Date.now() },
              chunks,
            );
          }
          setChunks(chunks);
          setLang(outcome.lang);
          setStatus('ready');
        } else if (outcome.status === 'no-captions') {
          if (db) {
            await saveTranscript(
              db,
              { videoId, lang: null, source: 'captions', fetchedAt: Date.now() },
              [],
            );
          }
          setStatus('no-captions');
        } else {
          setError(outcome.message);
          setStatus('error');
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { status, chunks, lang, error, retry };
}
