import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * extract_concepts.v1 (M11, ARCHITECTURE §5.4): recurring topics/concepts
 * across videos — deduplicated against the existing concept list so the
 * knowledge base converges instead of forking near-duplicates.
 */

export const extractConceptsV1Schema = z.object({
  concepts: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .max(6),
});

export type ExtractConceptsV1Output = z.infer<typeof extractConceptsV1Schema>;

export interface ExtractConceptsV1Input {
  title: string;
  language: 'de' | 'en';
  tldr: string;
  keyPoints: { text: string }[];
  /** Existing concept names for dedup (may be empty). */
  existingConcepts: string[];
}

export const extractConceptsV1: PromptTemplate = {
  id: 'extract_concepts.v1',
  system:
    'Du bist ein Wissens-Kurator. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Konzepte sind kurze, wiedererkennbare Themen-Begriffe (1–3 Wörter, z. B. „Tiefschlaf", „Gusseisen-Pflege") — keine Sätze. Wiederverwende vorhandene Konzeptnamen exakt, wenn sie passen.',
  render: (input) => {
    const { title, language, tldr, keyPoints, existingConcepts } = input as ExtractConceptsV1Input;
    const points = keyPoints.map((point) => `- ${point.text}`).join('\n');
    const existing =
      existingConcepts.length > 0
        ? `\nVorhandene Konzepte (bei Passung exakt übernehmen): ${existingConcepts.join(', ')}`
        : '';
    return `Video: ${title}\nSprache der Antwort: ${language}\n\nKurzfassung: ${tldr}\n\nKernaussagen:\n${points}\n${existing}\n\nErstelle JSON {"concepts": [{"name": string, "description": string (1–2 Sätze)}]} mit 0–6 Konzepten, die über dieses Video hinaus wiederverwendbar sind. Leere Liste, wenn nichts Tragfähiges dabei ist.`;
  },
};
