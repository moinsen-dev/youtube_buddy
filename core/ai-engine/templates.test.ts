import { pingV1, pingV1Schema } from './prompts/ping.v1';
import { summarizeV1, summarizeV1Schema } from './prompts/summarize.v1';
import { summarizeReduceV1, summarizeReduceV1Schema } from './prompts/summarize-reduce.v1';
import { chaptersV1, chaptersV1Schema } from './prompts/chapters.v1';
import { triageV1, triageV1Schema } from './prompts/triage.v1';
import { flashcardsV1, flashcardsV1Schema } from './prompts/flashcards.v1';
import { habitsV1, habitsV1Schema } from './prompts/habits.v1';
import { howtoV1, howtoV1Schema } from './prompts/howto.v1';
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

  it('flashcards.v1 requires >= 3 cards with source timestamps', () => {
    const prompt = flashcardsV1.render({
      title: 'Test',
      language: 'de',
      tldr: 'Kurz',
      keyPoints: [{ text: 'Kernaussage', sourceRefs: [{ startSec: 42 }] }],
    });
    expect(prompt).toContain('[42s] Kernaussage');

    const good = {
      cards: [
        { front: 'F1', back: 'B1', sourceSec: 42 },
        { front: 'F2', back: 'B2', sourceSec: 43 },
        { front: 'F3', back: 'B3', sourceSec: 44 },
      ],
    };
    expect(parseJsonOutput(JSON.stringify(good), flashcardsV1Schema)).toEqual(good);
    expect(() => flashcardsV1Schema.parse({ cards: good.cards.slice(0, 2) })).toThrow();
  });

  it('habits.v1 caps at 5 habits with cue', () => {
    const good = { habits: [{ title: 'Täglich 2 Minuten', cue: 'Wenn ich aufstehe' }] };
    expect(parseJsonOutput(JSON.stringify(good), habitsV1Schema)).toEqual(good);
    const tooMany = { habits: Array.from({ length: 6 }, (_, i) => ({ title: `h${i}`, cue: 'c' })) };
    expect(() => habitsV1Schema.parse(tooMany)).toThrow();
  });

  it('howto.v1 requires >= 2 steps and allows empty materials', () => {
    const prompt = howtoV1.render({
      title: 'Test',
      language: 'de',
      tldr: 'Kurz',
      summary: 'Lang',
      keyPoints: [{ text: 'Schritt eins', sourceRefs: [{ startSec: 10 }] }],
    });
    expect(prompt).toContain('[10s] Schritt eins');

    const good = {
      title: 'Guide',
      materials: [],
      steps: [
        { nr: 1, text: 'Erst', materialRefs: [], sourceSec: 10 },
        { nr: 2, text: 'Dann', materialRefs: [], sourceSec: 20 },
      ],
    };
    expect(parseJsonOutput(JSON.stringify(good), howtoV1Schema)).toEqual(good);
    expect(() => howtoV1Schema.parse({ ...good, steps: good.steps.slice(0, 1) })).toThrow();
  });
});
