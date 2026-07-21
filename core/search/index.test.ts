import {
  bytesToFloat32,
  cosineSimilarity,
  float32ToBytes,
  knn,
  reciprocalRankFusion,
} from './index';

describe('float32 bytes round-trip', () => {
  it('preserves values exactly', () => {
    const vector = new Float32Array([1.5, -2.25, 0.125]);
    expect(bytesToFloat32(float32ToBytes(vector))).toEqual(vector);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical and 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(a, new Float32Array([0, 1, 0]))).toBeCloseTo(0, 5);
  });

  it('handles zero vectors without NaN', () => {
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 0]))).toBe(0);
  });
});

describe('knn', () => {
  it('returns the nearest rows first, capped at k', () => {
    const query = new Float32Array([1, 0]);
    const rows = [
      { ownerType: 'note' as const, ownerId: 1, vector: float32ToBytes(new Float32Array([0, 1])) },
      { ownerType: 'note' as const, ownerId: 2, vector: float32ToBytes(new Float32Array([1, 0])) },
      {
        ownerType: 'note' as const,
        ownerId: 3,
        vector: float32ToBytes(new Float32Array([0.9, 0.1])),
      },
    ];
    const hits = knn(query, rows, 2);
    expect(hits.map((hit) => hit.row.ownerId)).toEqual([2, 3]);
  });
});

describe('reciprocalRankFusion', () => {
  it('boosts ids present in multiple lists and respects weights', () => {
    const fused = reciprocalRankFusion([
      { ids: ['note:1', 'note:2', 'note:3'], weight: 2 },
      { ids: ['note:3', 'note:1', 'note:4'], weight: 1 },
    ]);
    const sorted = [...fused.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe('note:1'); // in both lists, top of list 1
    expect(sorted.map(([id]) => id)).toContain('note:4');
    expect(fused.get('note:1')!).toBeGreaterThan(fused.get('note:2')!);
    expect(fused.get('note:3')!).toBeGreaterThan(fused.get('note:4')!);
  });

  it('keeps same rowids from different owner types apart (phase 9 regression)', () => {
    const fused = reciprocalRankFusion([
      { ids: ['analysis:3'], weight: 2 },
      { ids: ['note:3'], weight: 1 },
    ]);
    expect(fused.get('analysis:3')).toBeCloseTo(2 / 61, 6);
    expect(fused.get('note:3')).toBeCloseTo(1 / 61, 6);
  });
});
