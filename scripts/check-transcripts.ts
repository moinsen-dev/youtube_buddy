/**
 * Phase-3 exit check (M3): runs the caption extraction against 10 real
 * public videos (Kurzgesagt channel RSS — public endpoint, no auth) and
 * verifies that transcripts with correct timestamps come back.
 * Run: npx tsx scripts/check-transcripts.ts
 */
import { fetchTranscriptCues } from '../features/transcripts/captions-fetch';
import { chunkCues } from '../features/transcripts/chunker';

const RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q';

async function main() {
  const rss = await (await fetch(RSS_URL)).text();
  const videoIds = [...rss.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)]
    .map((match) => match[1])
    .slice(0, 10);
  console.log(`Found ${videoIds.length} videos in RSS feed\n`);

  let ok = 0;
  let failed = 0;
  for (const videoId of videoIds) {
    const outcome = await fetchTranscriptCues(videoId);
    if (outcome.status === 'ok') {
      const chunks = chunkCues(outcome.cues);
      // ASR cues overlap by design (rolling display) — require sane per-chunk
      // timestamps and non-decreasing starts, not strictly disjoint chunks.
      const startsNonDecreasing = chunks.every(
        (chunk, i) => i === 0 || chunk.startSec >= chunks[i - 1].startSec - 0.001,
      );
      const timestampsSane =
        chunks.length > 0 && chunks[0].startSec >= 0 && chunks.every((c) => c.endSec > c.startSec);
      const pass = startsNonDecreasing && timestampsSane;
      ok += pass ? 1 : 0;
      failed += pass ? 0 : 1;
      console.log(
        `${pass ? '✅' : '❌'} ${videoId}  lang=${outcome.lang}  cues=${outcome.cues.length}  chunks=${chunks.length}  first=[${chunks[0]?.startSec.toFixed(1)}s…]  startsNonDecreasing=${startsNonDecreasing}`,
      );
    } else {
      failed += 1;
      console.log(
        `❌ ${videoId}  status=${outcome.status}${outcome.status === 'error' ? ` (${outcome.message})` : ''}`,
      );
    }
  }
  console.log(`\nResult: ${ok}/10 ok, ${failed} failed`);
  process.exit(failed > 2 ? 1 : 0);
}

main().catch((error) => {
  console.error('check failed:', error);
  process.exit(1);
});
