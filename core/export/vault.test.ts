import { buildFrontmatter, sanitizeFileName } from './vault';
import type { NoteRow } from '@/core/db/repositories';

describe('sanitizeFileName', () => {
  it('removes illegal characters and trims', () => {
    expect(sanitizeFileName('Guide: Tisch/Arbeit')).toBe('Guide TischArbeit');
    expect(sanitizeFileName('  Leer?  ')).toBe('Leer');
    expect(sanitizeFileName('[[Koffein]]')).toBe('Koffein');
  });

  it('falls back to untitled for empty names', () => {
    expect(sanitizeFileName('///')).toBe('untitled');
  });
});

describe('buildFrontmatter', () => {
  const note: NoteRow = {
    id: 1,
    videoId: 'abc123',
    conceptId: null,
    type: 'summary',
    title: 'Test "Titel"',
    bodyMd: 'Inhalt',
    createdAt: Date.UTC(2026, 6, 20, 10, 0, 0),
    updatedAt: Date.UTC(2026, 6, 20, 11, 0, 0),
  };

  it('contains type, video link, source and timestamps', () => {
    const fm = buildFrontmatter(note, 'Mein Video');
    expect(fm).toContain('type: summary');
    expect(fm).toContain('video: https://youtu.be/abc123');
    expect(fm).toContain('source: "[[Video: Mein Video]]"');
    expect(fm).toContain('tags: [youtube-buddy, summary]');
    expect(fm.startsWith('---')).toBe(true);
    expect(fm.endsWith('---')).toBe(true);
  });

  it('escapes quotes and omits video fields without a video', () => {
    const fm = buildFrontmatter({ ...note, videoId: null }, null);
    expect(fm).not.toContain('video:');
    expect(fm).not.toContain('source:');
    expect(fm).toContain('title: "Test \\"Titel\\""');
  });
});
