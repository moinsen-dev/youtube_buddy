import { MODEL_REGISTRY, recommendedModel } from './model-registry';

describe('model-registry', () => {
  const GB = 1024 ** 3;

  it('recommends the largest fitting model for big devices', () => {
    const rec = recommendedModel(8 * GB);
    expect(rec.minRamBytes).toBeLessThanOrEqual(8 * GB);
  });

  it('recommends the 4 GB model for small devices', () => {
    const rec = recommendedModel(4 * GB);
    expect(rec.id).toBe('llama-32-3b-instruct-q4');
  });

  it('falls back to the smallest model when nothing fits', () => {
    const rec = recommendedModel(3 * GB);
    expect(rec.id).toBe('llama-32-3b-instruct-q4');
  });

  it('has unique ids and valid urls', () => {
    const ids = MODEL_REGISTRY.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spec of MODEL_REGISTRY) {
      expect(spec.url).toMatch(/^https:\/\/huggingface\.co\/.+\.gguf$/);
    }
  });
});
