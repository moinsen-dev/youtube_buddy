import { z } from 'zod';

import type { PromptTemplate } from '../types';

/**
 * habits.v1 (M6, PRD: „Aus diesem Video: 3 umsetzbare Gewohnheiten"): small,
 * actionable habits with a trigger cue, derived from the video analysis.
 */

export const habitsV1Schema = z.object({
  habits: z
    .array(
      z.object({
        title: z.string().min(1),
        cue: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
});

export type HabitsV1Output = z.infer<typeof habitsV1Schema>;

export interface HabitsV1Input {
  title: string;
  language: 'de' | 'en';
  tldr: string;
  keyPoints: { text: string }[];
}

export const habitsV1: PromptTemplate = {
  id: 'habits.v1',
  system:
    'Du bist ein Verhaltens-Coach. Antworte ausschließlich mit einem einzigen validen JSON-Objekt. Gewohnheiten müssen konkret, klein und alltagstauglich sein — keine abstrakten Vorsätze.',
  render: (input) => {
    const { title, language, tldr, keyPoints } = input as HabitsV1Input;
    const points = keyPoints.map((point) => `- ${point.text}`).join('\n');
    return `Video: ${title}\nSprache der Antwort: ${language}\n\nKurzfassung: ${tldr}\n\nKernaussagen:\n${points}\n\nLeite 1–3 umsetzbare Gewohnheiten ab als JSON {"habits": [{"title": string (konkrete Handlung), "cue": string (Auslöser: „Wenn …, dann …")}]}. Wenn das Video keine umsetzbaren Gewohnheiten hergibt, liefere genau eine naheliegende Mini-Gewohnheit.`;
  },
};
