import { z } from 'zod';

import type { PromptTemplate } from '../types';

/** Smoke template for engine bring-up and benchmarking (not a product feature). */
export const pingV1Schema = z.object({
  answer: z.string(),
  number: z.number(),
});

export type PingV1Output = z.infer<typeof pingV1Schema>;

export const pingV1: PromptTemplate = {
  id: 'ping.v1',
  system:
    'You are a precise assistant that always answers with a single valid JSON object, nothing else.',
  render: () => 'Answer this question with JSON {"answer": string, "number": number}: What is 2+2?',
};
