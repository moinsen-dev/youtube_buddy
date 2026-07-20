import { resolveBodyLinks, rewriteLinkInBody, type LinkLookup } from './resolver';

describe('resolveBodyLinks', () => {
  const lookup: LinkLookup = {
    findConceptNoteId: async (name) => (name === 'koffein' ? 42 : null),
    findNoteIdByTitle: async (title) => (title.toLowerCase() === 'schlaf guide' ? 7 : null),
  };

  it('resolves concepts first, then note titles, keeps unresolved at 0', async () => {
    const links = await resolveBodyLinks(
      'A [[Koffein]] B [[Schlaf Guide]] C [[Unbekannt]]',
      lookup,
    );
    expect(links).toEqual([
      { dstNoteId: 42, dstConceptName: 'Koffein', resolved: 1 },
      { dstNoteId: 7, dstConceptName: 'Schlaf Guide', resolved: 1 },
      { dstNoteId: null, dstConceptName: 'Unbekannt', resolved: 0 },
    ]);
  });

  it('never resolves to the note itself', async () => {
    const links = await resolveBodyLinks('[[Schlaf Guide]]', lookup, 7);
    expect(links).toEqual([{ dstNoteId: null, dstConceptName: 'Schlaf Guide', resolved: 0 }]);
  });
});

describe('rewriteLinkInBody (rename updates links)', () => {
  it('rewrites case-insensitively and preserves aliases', () => {
    const body = 'A [[Koffein]] B [[koffein|der Stoff]] C [[Koffein im Kaffee]]';
    expect(rewriteLinkInBody(body, 'Koffein', 'Koffein (Coffein)')).toBe(
      'A [[Koffein (Coffein)]] B [[Koffein (Coffein)|der Stoff]] C [[Koffein im Kaffee]]',
    );
  });

  it('escapes regex metacharacters in the target', () => {
    expect(rewriteLinkInBody('x [[C++]] y', 'C++', 'Cpp')).toBe('x [[Cpp]] y');
  });

  it('leaves plain text untouched', () => {
    expect(rewriteLinkInBody('kein Link hier', 'Koffein', 'Neu')).toBe('kein Link hier');
  });
});
