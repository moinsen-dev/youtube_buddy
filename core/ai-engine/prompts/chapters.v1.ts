import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * chapters.v1 (M5): derives video chapters with start timestamps from the
 * timed partial summaries (works for videos without creator chapters).
 * Timestamps must come from the supplied section starts.
 */

export const chaptersV1Schema = z.object({
  chapters: z
    .array(
      z.object({
        startSec: z.number().nonnegative(),
        title: z.string().min(1),
      }),
    )
    .min(1),
});

export type ChaptersV1Output = z.infer<typeof chaptersV1Schema>;

export interface ChaptersV1Input {
  title: string;
  language: 'de' | 'en';
  partials: { startSec: number; tldr: string }[];
}

export const chaptersV1: PromptTemplate = {
  id: 'chapters.v1',
  system:
    'Du bist ein präziser Analyse-Assistent. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Kapitel-Zeitstempel (startSec) müssen aus den gelieferten Abschnitts-Zeiten stammen und strikt aufsteigend sein.',
  render: (input) => {
    const { title, language, partials } = input as ChaptersV1Input;
    const parts = partials
      .map((partial) => `[ab ${partial.startSec.toFixed(0)}s] ${partial.tldr}`)
      .join('\n');
    return `Video: ${title}\nSprache der Kapiteltitel: ${language}\n\nAbschnitte (zeitlich geordnet):\n${parts}\n\nErstelle JSON {"chapters": [{"startSec": number, "title": string}]} — sinnvolle Kapitel über das ganze Video, strikt aufsteigende startSec-Werte aus den Abschnitts-Zeiten.`;
  },
};
