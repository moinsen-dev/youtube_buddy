import { extractWikiLinks, linkKey, splitBodySegments } from './wiki-links';

describe('extractWikiLinks', () => {
  it('extracts unique targets in order of appearance', () => {
    const body = 'Verknüpft mit [[Koffein]] und [[Morgenlicht]], siehe auch [[Koffein]].';
    expect(extractWikiLinks(body)).toEqual(['Koffein', 'Morgenlicht']);
  });

  it('handles aliases and trims whitespace', () => {
    expect(extractWikiLinks('[[ Tiefschlaf |deep sleep]] x [[Graph]]')).toEqual([
      'Tiefschlaf',
      'Graph',
    ]);
  });

  it('ignores empty and malformed links', () => {
    expect(extractWikiLinks('[[]] [x] [[  ]] plain [text]')).toEqual([]);
  });

  it('dedupes case-insensitively but keeps first spelling', () => {
    expect(extractWikiLinks('[[Koffein]] [[koffein]] [[KOFFEIN]]')).toEqual(['Koffein']);
  });
});

describe('linkKey', () => {
  it('normalizes case and whitespace', () => {
    expect(linkKey('  Tiefschlaf ')).toBe('tiefschlaf');
  });
});

describe('splitBodySegments', () => {
  it('splits into text and link segments', () => {
    const segments = splitBodySegments('A [[One]] B [[Two|two]] C');
    expect(segments).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'link', target: 'One' },
      { kind: 'text', text: ' B ' },
      { kind: 'link', target: 'Two' },
      { kind: 'text', text: ' C' },
    ]);
  });

  it('returns a single text segment without links', () => {
    expect(splitBodySegments('plain')).toEqual([{ kind: 'text', text: 'plain' }]);
  });
});
