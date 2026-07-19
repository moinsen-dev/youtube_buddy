import type { Cue } from './chunker';
import type { TranscriptOutcome } from './captions-fetch';

/**
 * Web caption source: youtube.com blocks cross-origin fetches (CORS), so web
 * goes through the same-origin API route (app/api/transcript/[id]+api.ts).
 */
export type { TranscriptOutcome };

export async function fetchTranscriptCues(videoId: string): Promise<TranscriptOutcome> {
  try {
    const response = await fetch(`/api/transcript/${videoId}`);
    if (!response.ok) {
      return { status: 'error', message: `API-Route HTTP ${response.status}` };
    }
    return (await response.json()) as TranscriptOutcome;
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export type { Cue };
