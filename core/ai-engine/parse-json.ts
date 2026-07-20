import type { z } from 'zod';

/**
 * Tolerant JSON output parser (ARCHITECTURE §3.3): strips markdown fences,
 * finds the first {...} block, validates with zod. Returns null on failure
 * (caller then runs the single repair retry).
 */
export function parseJsonOutput<T>(raw: string, schema: z.ZodType<T>): T | null {
  const candidates = [raw.trim()];
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());
  const braceMatch = /(\{[\s\S]*\})/.exec(raw);
  if (braceMatch) candidates.push(braceMatch[1]);

  for (const candidate of candidates) {
    try {
      return schema.parse(JSON.parse(candidate));
    } catch {
      // try next candidate
    }
  }
  return null;
}
