/**
 * Chunks cues into ~800-character segments while preserving timestamps
 * (ARCHITECTURE §5.2): chunks never split a cue; start/end come from the
 * first/last cue of each segment.
 */

export interface Cue {
  startMs: number;
  durMs: number;
  text: string;
}

export interface TranscriptChunk {
  idx: number;
  startSec: number;
  endSec: number;
  text: string;
}

export const DEFAULT_CHUNK_MAX_CHARS = 800;

export function chunkCues(
  cues: Cue[],
  maxChars: number = DEFAULT_CHUNK_MAX_CHARS,
): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let current: Cue[] = [];
  let currentChars = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      idx: chunks.length,
      startSec: current[0].startMs / 1000,
      endSec: (current[current.length - 1].startMs + current[current.length - 1].durMs) / 1000,
      text: current.map((cue) => cue.text).join(' '),
    });
    current = [];
    currentChars = 0;
  };

  for (const cue of cues) {
    const cueLen = cue.text.length + 1; // plus joining space
    if (current.length > 0 && currentChars + cueLen > maxChars) {
      flush();
    }
    current.push(cue);
    currentChars += cueLen;
  }
  flush();
  return chunks;
}
