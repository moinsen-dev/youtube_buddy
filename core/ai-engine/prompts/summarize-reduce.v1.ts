import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * summarize-reduce.v1 (M5): merges per-group partial summaries (map step via
 * summarize.v1) into the final analysis — TL;DR, long-form summary and key
 * points with mandatory source timestamps. Output language follows the UI
 * language (ARCHITECTURE §3.3).
 */

export const summarizeReduceV1Schema = z.object({
  tldr: z.string().min(1),
  summary: z.string().min(1),
  keyPoints: z
    .array(
      z.object({
        text: z.string().min(1),
        sourceRefs: z.array(z.object({ startSec: z.number().nonnegative() })).min(1),
      }),
    )
    .min(3),
});

export type SummarizeReduceV1Output = z.infer<typeof summarizeReduceV1Schema>;

export interface SummarizeReduceV1Input {
  title: string;
  language: 'de' | 'en';
  partials: { startSec: number; tldr: string }[];
}

export const summarizeReduceV1: PromptTemplate = {
  id: 'summarize-reduce.v1',
  system:
    'Du bist ein präziser Analyse-Assistent. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Zeitstempel-Referenzen (sourceRefs.startSec) sind Pflicht und müssen aus den gelieferten Abschnitten stammen.',
  render: (input) => {
    const { title, language, partials } = input as SummarizeReduceV1Input;
    const parts = partials
      .map((partial) => `[ab ${partial.startSec.toFixed(0)}s] ${partial.tldr}`)
      .join('\n');
    return `Video: ${title}\nSprache der Zusammenfassung: ${language}\n\nTeil-Zusammenfassungen (zeitlich geordnet):\n${parts}\n\nErstelle JSON {"tldr": string (2–3 Sätze), "summary": string (ausführlich, mehrere Absätze), "keyPoints": [{"text": string, "sourceRefs": [{"startSec": number}]}]} mit mindestens 3 keyPoints.`;
  },
};
