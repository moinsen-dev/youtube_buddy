import { pingV1, pingV1Schema } from './prompts/ping.v1';
import { summarizeV1, summarizeV1Schema } from './prompts/summarize.v1';
import { parseJsonOutput } from './parse-json';

describe('prompt templates', () => {
  it('ping.v1 renders and its schema validates a well-formed answer', () => {
    expect(pingV1.id).toBe('ping.v1');
    expect(pingV1.render({})).toContain('2+2');
    const parsed = parseJsonOutput('{"answer":"4","number":4}', pingV1Schema);
    expect(parsed).toEqual({ answer: '4', number: 4 });
  });

  it('summarize.v1 renders transcript chunks with timestamps', () => {
    const prompt = summarizeV1.render({
      title: 'Test',
      language: 'de',
      chunks: [
        { startSec: 12, text: 'erster Abschnitt' },
        { startSec: 34.5, text: 'zweiter Abschnitt' },
      ],
    });
    expect(prompt).toContain('[12s] erster Abschnitt');
    expect(prompt).toContain('[35s] zweiter Abschnitt');
  });

  it('summarize.v1 schema enforces >= 3 keyPoints with sourceRefs', () => {
    const good = {
      tldr: 'kurz',
      keyPoints: [
        { text: 'a', sourceRefs: [{ startSec: 1 }] },
        { text: 'b', sourceRefs: [{ startSec: 2 }] },
        { text: 'c', sourceRefs: [{ startSec: 3 }] },
      ],
    };
    expect(() => summarizeV1Schema.parse(good)).not.toThrow();

    const missing = { tldr: 'kurz', keyPoints: [{ text: 'a', sourceRefs: [] }] };
    expect(() => summarizeV1Schema.parse(missing)).toThrow();
  });
});
