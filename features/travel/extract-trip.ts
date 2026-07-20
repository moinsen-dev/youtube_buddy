import type { LLMEngine } from '@/core/ai-engine/types';
import { extractPlacesV2, extractPlacesV2Schema } from '@/core/ai-engine/prompts/extract-places.v2';
import type { SummarizeReduceV1Output } from '@/core/ai-engine/prompts/summarize-reduce.v1';
import type { Db } from '@/core/db/repositories';
import {
  getAnalysis,
  getVideo,
  insertTrip,
  insertTripPlaces,
  listTripPlaces,
  updateTripNoteId,
  updateTripPlace,
} from '@/core/db/repositories';
import { defaultLocale } from '@/core/i18n/strings';
import { saveNoteWithLinks } from '@/core/markdown/note-store';

import { geocodePlace } from './geocoding';

/**
 * Travel pipeline (M7, ARCHITECTURE §5.5): from the video analysis to a
 * trip with ordered places + trip note. Geocoding only runs when
 * settings.geocoding_opt_in = 'true' (Nominatim, PRD §7.4); otherwise
 * places stay 'pending' for manual pinning.
 */
export async function extractTripForVideo(
  engine: LLMEngine,
  db: Db,
  videoId: string,
  options: { geocode: boolean },
): Promise<{ tripId: number; places: number; geocoded: number }> {
  const analysisRow = await getAnalysis(db, videoId, 'summary');
  if (!analysisRow) throw new Error('Keine Analyse vorhanden — erst „Analysieren" ausführen.');
  const summary = JSON.parse(analysisRow.payload) as SummarizeReduceV1Output;
  const video = await getVideo(db, videoId);
  const title = video?.title ?? videoId;

  const result = await engine.generate({
    template: extractPlacesV2,
    input: {
      title,
      language: defaultLocale,
      tldr: summary.tldr,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
    },
    schema: extractPlacesV2Schema,
  });

  const now = Date.now();
  const tripId = await insertTrip(db, { title: `Reise: ${title}`, noteId: null, createdAt: now });

  const placeRows = result.data.places.map((place, index) => ({
    tripId,
    videoId,
    name: place.name,
    lat: null,
    lon: null,
    sourceSec: Math.round(place.sourceSec),
    position: index,
    geocodeStatus: 'pending' as const,
  }));
  await insertTripPlaces(db, placeRows);

  let geocoded = 0;
  if (options.geocode) {
    const persisted = await listTripPlaces(db, tripId);
    for (const place of persisted) {
      const hit = await geocodePlace(place.name);
      if (hit) {
        await updateTripPlace(db, place.id, { lat: hit.lat, lon: hit.lon, geocodeStatus: 'ok' });
        geocoded += 1;
      } else {
        await updateTripPlace(db, place.id, { geocodeStatus: 'failed' });
      }
    }
  }

  const tripNoteId = await saveNoteWithLinks(db, {
    videoId,
    conceptId: null,
    type: 'trip',
    title: `Reise: ${title}`,
    bodyMd: [
      `Reiseroute aus dem Video (${result.data.places.length} Orte):`,
      '',
      ...result.data.places.map(
        (place, index) =>
          `${index + 1}. ${place.name} (${formatSec(place.sourceSec)})${options.geocode ? '' : ' — Koordinaten manuell setzen'}`,
      ),
    ].join('\n'),
    createdAt: now,
    updatedAt: now,
  });
  await updateTripNoteId(db, tripId, tripNoteId);

  return { tripId, places: result.data.places.length, geocoded };
}

function formatSec(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
