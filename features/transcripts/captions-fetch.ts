import { YoutubeTranscript } from 'youtube-transcript';

import type { Cue } from './chunker';

/**
 * Network side of the caption extraction (PRD §7.1 gray zone, adapter
 * layer): wraps the youtube-transcript library, which tracks YouTube's
 * endpoint changes. Runs natively and server-side (API route) — web clients
 * call the API route instead (CORS, see captions-source.web.ts).
 */

export type TranscriptOutcome =
  | { status: 'ok'; lang: string; cues: Cue[] }
  | { status: 'no-captions' }
  | { status: 'error'; message: string };

const LANGUAGE_FALLBACK = ['de', 'en'] as const;

export async function fetchTranscriptCues(videoId: string): Promise<TranscriptOutcome> {
  let lastError: unknown = null;
  for (const lang of [...LANGUAGE_FALLBACK, undefined]) {
    try {
      const cues = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      const mapped = cues
        .map((cue) => ({
          startMs: cue.offset,
          durMs: cue.duration,
          text: cue.text.replace(/\s+/g, ' ').trim(),
        }))
        .filter((cue) => cue.text.length > 0);
      if (mapped.length === 0) continue;
      return { status: 'ok', lang: cues[0].lang ?? lang ?? 'und', cues: mapped };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error && /no transcripts? (are )?available/i.test(lastError.message)) {
    return { status: 'no-captions' };
  }
  return {
    status: 'error',
    message: lastError instanceof Error ? lastError.message : String(lastError),
  };
}
