import { findOpenWikiLink } from './markdown-editor';

describe('findOpenWikiLink', () => {
  it('detects an open wiki link at the cursor', () => {
    expect(findOpenWikiLink('text [[Koff', 11)).toEqual({ start: 5, fragment: 'Koff' });
  });

  it('returns null for closed links and newlines', () => {
    expect(findOpenWikiLink('text [[Koffein]] x', 16)).toBeNull();
    expect(findOpenWikiLink('[[abc\ndef', 8)).toBeNull();
    expect(findOpenWikiLink('plain', 5)).toBeNull();
  });

  it('supports an empty fragment right after [[', () => {
    expect(findOpenWikiLink('x [[', 4)).toEqual({ start: 2, fragment: '' });
  });
});
