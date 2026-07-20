import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * extract_places.v2 (M7): like v1, but extracts up to 8 places including
 * specific POIs/districts — v1 proved too coarse (only ~3 cities on a rich
 * travel vlog; ROADMAP Phase 8 exit wants ≥ 4).
 */

export const extractPlacesV2Schema = z.object({
  places: z
    .array(
      z.object({
        name: z.string().min(1),
        sourceSec: z.number().nonnegative(),
      }),
    )
    .min(2)
    .max(8),
});

export type ExtractPlacesV2Output = z.infer<typeof extractPlacesV2Schema>;

export interface ExtractPlacesV2Input {
  title: string;
  language: 'de' | 'en';
  tldr: string;
  summary: string;
  keyPoints: { text: string; sourceRefs: { startSec: number }[] }[];
}

export const extractPlacesV2: PromptTemplate = {
  id: 'extract_places.v2',
  system:
    'Du bist ein Reise-Analyse-Assistent. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Extrahiere nur Orte, die im Video tatsächlich besucht/gezeigt werden — in Reisereihenfolge, mit Zeitstempel (sourceSec) aus den gelieferten Abschnitten. Neben Städten auch konkrete POIs/Stadtteile/Sehenswürdigkeiten (z. B. „Dotonbori, Osaka", „Fushimi Inari, Kyoto"). Ortsnamen geocoding-tauglich (immer mit Stadt/Land-Kontext).',
  render: (input) => {
    const { title, language, tldr, summary, keyPoints } = input as ExtractPlacesV2Input;
    const points = keyPoints
      .map((point) => `- [${point.sourceRefs[0]?.startSec?.toFixed(0) ?? 0}s] ${point.text}`)
      .join('\n');
    return `Video: ${title}\nSprache der Antwort: ${language}\n\nKurzfassung: ${tldr}\n\nZusammenfassung: ${summary}\n\nKernaussagen mit Zeitstempeln:\n${points}\n\nErstelle JSON {"places": [{"name": string, "sourceSec": number}]} — 4–8 besuchte Orte in Reihenfolge der Reise (Städte UND konkrete POIs/Stadtteile).`;
  },
};
