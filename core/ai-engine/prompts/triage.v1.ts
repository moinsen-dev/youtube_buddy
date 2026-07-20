import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * triage.v1 (M5, PRD „Lohnt sich das?"): score 1–5 + reason + estimated
 * value density ("Nutzen pro Minute") + rough category. Runs on cheap input
 * (title + duration + TL;DR) so it can batch over the Watch-Later queue.
 */

export const triageV1Schema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string().min(1),
  density: z.enum(['niedrig', 'mittel', 'hoch']),
  category: z.string().min(1),
});

export type TriageV1Output = z.infer<typeof triageV1Schema>;

export interface TriageV1Input {
  title: string;
  durationSec: number;
  tldr: string;
  language: 'de' | 'en';
}

export const triageV1: PromptTemplate = {
  id: 'triage.v1',
  system:
    'Du bist ein kritischer Kuratier-Assistent. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Bewerte ehrlich: Clickbait ohne Substanz bekommt 1–2, solide Inhalte 3, dichte Evergreen-Inhalte 4–5.',
  render: (input) => {
    const { title, durationSec, tldr, language } = input as TriageV1Input;
    const minutes = Math.max(1, Math.round(durationSec / 60));
    return `Video: ${title}\nDauer: ${minutes} min\nInhalt (Kurzfassung): ${tldr}\nSprache der Antwort: ${language}\n\nErstelle JSON {"score": 1|2|3|4|5, "reason": string (1–2 Sätze), "density": "niedrig"|"mittel"|"hoch" (Nutzen pro Minute), "category": string (z. B. Tutorial, Essay, Vlog, Review, News, Unterhaltung)}.`;
  },
};
