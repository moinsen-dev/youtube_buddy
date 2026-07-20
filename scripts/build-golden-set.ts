/**
 * Builds the golden set fixture (ROADMAP: "Golden-Set aus 10 Beispiel-Videos
 * (Transkripte im Repo)") by fetching transcripts for the 10 newest videos
 * from the Kurzgesagt channel RSS feed (public, no auth).
 * Run: npx tsx scripts/build-golden-set.ts
 */
import { writeFileSync } from 'node:fs';

import { fetchTranscriptCues } from '../features/transcripts/captions-fetch';
import { chunkCues } from '../features/transcripts/chunker';

const RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q';
const OUT = 'core/ai-engine/golden-set.json';

interface GoldenSetItem {
  videoId: string;
  title: string;
  language: string;
  chunks: { startSec: number; endSec: number; text: string }[];
}

async function main() {
  const rss = await (await fetch(RSS_URL)).text();
  const videoIds = [...rss.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)]
    .map((m) => m[1])
    .slice(0, 10);
  const titles = [...rss.matchAll(/<title>([^<]+)<\/title>/g)].map((m) => m[1]).slice(1, 11);

  const items: GoldenSetItem[] = [];
  for (const [index, videoId] of videoIds.entries()) {
    const outcome = await fetchTranscriptCues(videoId);
    if (outcome.status !== 'ok') {
      console.warn(`skip ${videoId}: ${outcome.status}`);
      continue;
    }
    items.push({
      videoId,
      title: titles[index] ?? videoId,
      language: outcome.lang,
      chunks: chunkCues(outcome.cues).map(({ startSec, endSec, text }) => ({
        startSec,
        endSec,
        text,
      })),
    });
    console.log(`ok ${videoId} (${outcome.lang}, ${items[items.length - 1].chunks.length} chunks)`);
  }

  writeFileSync(OUT, JSON.stringify({ version: 1, createdAt: Date.now(), items }, null, 2));
  console.log(`\nWrote ${items.length} items to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
