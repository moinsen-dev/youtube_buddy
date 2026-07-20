import { pingV1, pingV1Schema } from './prompts/ping.v1';
import { summarizeV1, summarizeV1Schema } from './prompts/summarize.v1';
import { summarizeReduceV1, summarizeReduceV1Schema } from './prompts/summarize-reduce.v1';
import { chaptersV1, chaptersV1Schema } from './prompts/chapters.v1';
import { triageV1, triageV1Schema } from './prompts/triage.v1';
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

  it('summarize-reduce.v1 renders partials and validates the final shape', () => {
    const prompt = summarizeReduceV1.render({
      title: 'Test',
      language: 'de',
      partials: [
        { startSec: 0, tldr: 'Anfang' },
        { startSec: 240, tldr: 'Mitte' },
      ],
    });
    expect(prompt).toContain('[ab 0s] Anfang');
    expect(prompt).toContain('[ab 240s] Mitte');

    const good = {
      tldr: 'kurz',
      summary: 'lang',
      keyPoints: [
        { text: 'a', sourceRefs: [{ startSec: 0 }] },
        { text: 'b', sourceRefs: [{ startSec: 240 }] },
        { text: 'c', sourceRefs: [{ startSec: 480 }] },
      ],
    };
    expect(parseJsonOutput(JSON.stringify(good), summarizeReduceV1Schema)).toEqual(good);
    expect(() => summarizeReduceV1Schema.parse({ tldr: 'x', keyPoints: good.keyPoints })).toThrow();
  });

  it('chapters.v1 requires ascending chapter timestamps with titles', () => {
    const prompt = chaptersV1.render({
      title: 'Test',
      language: 'en',
      partials: [{ startSec: 90, tldr: 'Intro' }],
    });
    expect(prompt).toContain('[ab 90s] Intro');

    const good = {
      chapters: [
        { startSec: 0, title: 'Intro' },
        { startSec: 90, title: 'Main' },
      ],
    };
    expect(parseJsonOutput(JSON.stringify(good), chaptersV1Schema)).toEqual(good);
    expect(() => chaptersV1Schema.parse({ chapters: [] })).toThrow();
  });

  it('triage.v1 clamps the score range and the density enum', () => {
    const prompt = triageV1.render({
      title: 'Test',
      durationSec: 600,
      tldr: 'Inhalt',
      language: 'de',
    });
    expect(prompt).toContain('Dauer: 10 min');

    const good = { score: 4, reason: 'dicht', density: 'hoch', category: 'Tutorial' };
    expect(parseJsonOutput(JSON.stringify(good), triageV1Schema)).toEqual(good);
    expect(() => triageV1Schema.parse({ ...good, score: 6 })).toThrow();
    expect(() => triageV1Schema.parse({ ...good, score: 2.5 })).toThrow();
    expect(() => triageV1Schema.parse({ ...good, density: 'viel' })).toThrow();
  });
});
