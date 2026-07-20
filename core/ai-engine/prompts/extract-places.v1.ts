import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * extract_places.v1 (M7, ARCHITECTURE §5.5): places/POIs of a travel video
 * in route order with source timestamps. Names should be geocodable
 * (city/POI + country hint when inferable).
 */

export const extractPlacesV1Schema = z.object({
  places: z
    .array(
      z.object({
        name: z.string().min(1),
        sourceSec: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export type ExtractPlacesV1Output = z.infer<typeof extractPlacesV1Schema>;

export interface ExtractPlacesV1Input {
  title: string;
  language: 'de' | 'en';
  tldr: string;
  summary: string;
  keyPoints: { text: string; sourceRefs: { startSec: number }[] }[];
}

export const extractPlacesV1: PromptTemplate = {
  id: 'extract_places.v1',
  system:
    'Du bist ein Reise-Analyse-Assistent. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Extrahiere nur Orte, die im Video tatsächlich besucht/gezeigt werden — in Reisereihenfolge, mit Zeitstempel (sourceSec) aus den gelieferten Abschnitten. Ortsnamen geocoding-tauglich (Stadt/POI, bei Kleinstädten gern mit Land/Region).',
  render: (input) => {
    const { title, language, tldr, summary, keyPoints } = input as ExtractPlacesV1Input;
    const points = keyPoints
      .map((point) => `- [${point.sourceRefs[0]?.startSec?.toFixed(0) ?? 0}s] ${point.text}`)
      .join('\n');
    return `Video: ${title}\nSprache der Antwort: ${language}\n\nKurzfassung: ${tldr}\n\nZusammenfassung: ${summary}\n\nKernaussagen mit Zeitstempeln:\n${points}\n\nErstelle JSON {"places": [{"name": string, "sourceSec": number}]} — besuchte Orte in Reihenfolge der Reise.`;
  },
};
