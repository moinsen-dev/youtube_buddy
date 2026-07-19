/**
 * Native caption source: direct fetch from the device (no CORS on
 * iOS/Android). Web uses captions-source.web.ts (API route).
 */
export { fetchTranscriptCues } from './captions-fetch';
export type { TranscriptOutcome } from './captions-fetch';
