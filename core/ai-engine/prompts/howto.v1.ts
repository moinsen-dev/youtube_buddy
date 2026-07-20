import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * howto.v1 (M6): ordered step-by-step guide with material references and
 * source timestamps per step (Guide-Modus, DESIGN 5.7/5.12).
 */

export const howtoV1Schema = z.object({
  title: z.string().min(1),
  materials: z.array(z.object({ name: z.string().min(1) })),
  steps: z
    .array(
      z.object({
        nr: z.number().int().positive(),
        text: z.string().min(1),
        materialRefs: z.array(z.string()),
        sourceSec: z.number().nonnegative(),
      }),
    )
    .min(2),
});

export type HowtoV1Output = z.infer<typeof howtoV1Schema>;

export interface HowtoV1Input {
  title: string;
  language: 'de' | 'en';
  tldr: string;
  summary: string;
  keyPoints: { text: string; sourceRefs: { startSec: number }[] }[];
}

export const howtoV1: PromptTemplate = {
  id: 'howto.v1',
  system:
    'Du bist ein Anleitungs-Assistent für Schritt-für-Schritt-Guides. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Schritte müssen handlungsorientiert, geordnet und mit Zeitstempel-Quellen (sourceSec) aus den gelieferten Abschnitten versehen sein.',
  render: (input) => {
    const { title, language, tldr, summary, keyPoints } = input as HowtoV1Input;
    const points = keyPoints
      .map((point) => `- [${point.sourceRefs[0]?.startSec?.toFixed(0) ?? 0}s] ${point.text}`)
      .join('\n');
    return `Video: ${title}\nSprache der Anleitung: ${language}\n\nKurzfassung: ${tldr}\n\nZusammenfassung: ${summary}\n\nKernaussagen mit Zeitstempeln:\n${points}\n\nErstelle eine Schritt-für-Schritt-Anleitung als JSON {"title": string, "materials": [{"name": string}], "steps": [{"nr": 1, "text": string, "materialRefs": [string], "sourceSec": number}]}. materials = benötigte Zutaten/Werkzeuge (leer, wenn keine nötig); materialRefs verweisen auf materials-Namen; nr aufsteigend ab 1.`;
  },
};
