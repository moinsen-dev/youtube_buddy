import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * flashcards.v1 (M6): Q/A cards from the video analysis — each card carries
 * a source timestamp for the player jump (ARCHITECTURE §5.3).
 */

export const flashcardsV1Schema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
        sourceSec: z.number().nonnegative(),
      }),
    )
    .min(3),
});

export type FlashcardsV1Output = z.infer<typeof flashcardsV1Schema>;

export interface FlashcardsV1Input {
  title: string;
  language: 'de' | 'en';
  tldr: string;
  keyPoints: { text: string; sourceRefs: { startSec: number }[] }[];
}

export const flashcardsV1: PromptTemplate = {
  id: 'flashcards.v1',
  system:
    'Du bist ein Lern-Assistent, der prägnante Lernkarten erstellt. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Jede Karte braucht einen Zeitstempel (sourceSec) aus den gelieferten Quellen.',
  render: (input) => {
    const { title, language, tldr, keyPoints } = input as FlashcardsV1Input;
    const points = keyPoints
      .map((point) => `- [${point.sourceRefs[0]?.startSec?.toFixed(0) ?? 0}s] ${point.text}`)
      .join('\n');
    return `Video: ${title}\nSprache der Karten: ${language}\n\nKurzfassung: ${tldr}\n\nKernaussagen mit Zeitstempeln:\n${points}\n\nErstelle 6–10 Lernkarten als JSON {"cards": [{"front": string (Frage), "back": string (Antwort, 1–2 Sätze), "sourceSec": number}]}. Jede Karte prüft genau eine Kernaussage; sourceSec kommt aus den gelieferten Zeitstempeln.`;
  },
};
