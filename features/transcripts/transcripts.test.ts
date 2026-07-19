import { chunkCues, type Cue } from './chunker';

describe('chunkCues', () => {
  const makeCues = (count: number, textLen: number): Cue[] =>
    Array.from({ length: count }, (_, i) => ({
      startMs: i * 2000,
      durMs: 2000,
      text: 'x'.repeat(textLen),
    }));

  it('chunks at the size boundary without splitting cues', () => {
    const chunks = chunkCues(makeCues(10, 100), 350);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(350);
      expect(chunk.text).not.toBe('');
    }
  });

  it('preserves timestamps of first and last cue per chunk', () => {
    const chunks = chunkCues(makeCues(6, 100), 250);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(4); // cues 0+1 (2 s each)
    expect(chunks[1].startSec).toBe(4);
    expect(chunks[2].endSec).toBe(12);
    expect(chunks[0].idx).toBe(0);
    expect(chunks[1].idx).toBe(1);
  });

  it('keeps a single chunk when everything fits', () => {
    const chunks = chunkCues(makeCues(3, 50), 800);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(6);
  });

  it('returns [] for no cues', () => {
    expect(chunkCues([], 800)).toEqual([]);
  });
});
