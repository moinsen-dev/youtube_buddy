import { fetchTranscriptCues } from '@/features/transcripts/captions-fetch';

/**
 * Server-side transcript proxy for the web client (youtube.com caption
 * endpoints do not send CORS headers). Phase 3 dev use: Metro; production
 * web decision lands in phase 11 (ARCHITECTURE §11).
 */
export async function GET(_request: Request, { id }: { id: string }) {
  if (!id || !/^[\w-]{6,20}$/.test(id)) {
    return Response.json({ status: 'error', message: 'invalid video id' }, { status: 400 });
  }
  const outcome = await fetchTranscriptCues(id);
  const status = outcome.status === 'error' ? 502 : 200;
  return Response.json(outcome, { status });
}
