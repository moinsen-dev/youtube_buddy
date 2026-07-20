import { z } from 'zod';

import { parseJsonOutput } from './parse-json';

const schema = z.object({
  tldr: z.string(),
  points: z.array(z.string()).min(2),
});

describe('parseJsonOutput', () => {
  it('parses clean JSON', () => {
    expect(parseJsonOutput('{"tldr":"a","points":["x","y"]}', schema)).toEqual({
      tldr: 'a',
      points: ['x', 'y'],
    });
  });

  it('strips markdown fences', () => {
    const raw = 'Here is the result:\n```json\n{"tldr":"a","points":["x","y"]}\n```';
    expect(parseJsonOutput(raw, schema)).toEqual({ tldr: 'a', points: ['x', 'y'] });
  });

  it('finds the first {...} block in surrounding prose', () => {
    const raw = 'Sure! {"tldr":"a","points":["x","y"]} — hope that helps.';
    expect(parseJsonOutput(raw, schema)).toEqual({ tldr: 'a', points: ['x', 'y'] });
  });

  it('returns null on invalid schema', () => {
    expect(parseJsonOutput('{"tldr":"a","points":["x"]}', schema)).toBeNull();
  });

  it('returns null on non-JSON', () => {
    expect(parseJsonOutput('no json here', schema)).toBeNull();
  });
});
