import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * summarize.v1 (M5 precursor): TL;DR + key points with source timestamps.
 * Output language follows the UI language (ARCHITECTURE §3.3); timestamps
 * are mandatory fields.
 */

export const summarizeV1Schema = z.object({
  tldr: z.string().min(1),
  keyPoints: z
    .array(
      z.object({
        text: z.string().min(1),
        sourceRefs: z.array(z.object({ startSec: z.number().nonnegative() })).min(1),
      }),
    )
    .min(3),
});

export type SummarizeV1Output = z.infer<typeof summarizeV1Schema>;

export interface SummarizeV1Input {
  title: string;
  language: 'de' | 'en';
  chunks: { startSec: number; text: string }[];
}

export const summarizeV1: PromptTemplate = {
  id: 'summarize.v1',
  system:
    'Du bist ein präziser Analyse-Assistent. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Zeitstempel-Referenzen (sourceRefs.startSec) sind Pflicht und müssen aus den gelieferten Abschnitten stammen.',
  render: (input) => {
    const { title, language, chunks } = input as SummarizeV1Input;
    const transcript = chunks
      .map((chunk) => `[${chunk.startSec.toFixed(0)}s] ${chunk.text}`)
      .join('\n');
    return `Video: ${title}\nSprache der Zusammenfassung: ${language}\n\nTranskript-Abschnitte:\n${transcript}\n\nErstelle JSON {"tldr": string, "keyPoints": [{"text": string, "sourceRefs": [{"startSec": number}]}]} mit mindestens 3 keyPoints.`;
  },
};
