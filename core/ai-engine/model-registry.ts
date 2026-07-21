import type { ModelSpec } from './types';

/**
 * Model registry (M4, ARCHITECTURE §3.2): the three chat candidates.
 * sha256 is empty until pinned after the first verified download.
 */

const GB = 1024 ** 3;

export const MODEL_REGISTRY: ModelSpec[] = [
  {
    id: 'qwen3-4b-instruct-q4',
    name: 'Qwen3 4B Instruct (Q4)',
    url: 'https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
    sizeBytes: Math.round(2.5 * GB),
    sha256: '',
    contextLength: 32768,
    minRamBytes: Math.round(6 * GB),
    note: 'Default-Kandidat (ARCHITECTURE §3.2)',
  },
  {
    id: 'gemma-3-4b-it-q4',
    name: 'Gemma 3 4B IT (Q4)',
    url: 'https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf',
    sizeBytes: Math.round(2.5 * GB),
    sha256: '',
    contextLength: 32768,
    minRamBytes: Math.round(6 * GB),
    note: 'Alternative',
  },
  {
    id: 'llama-32-3b-instruct-q4',
    name: 'Llama 3.2 3B Instruct (Q4)',
    url: 'https://huggingface.co/unsloth/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: Math.round(1.9 * GB),
    sha256: '',
    contextLength: 16384,
    minRamBytes: Math.round(4 * GB),
    note: 'Für Geräte mit 4 GB RAM',
  },
];

export const EMBEDDING_MODEL_SPEC: ModelSpec = {
  id: 'paraphrase-multilingual-minilm-q4',
  name: 'Paraphrase Multilingual MiniLM (Q4)',
  url: 'https://huggingface.co/mykor/paraphrase-multilingual-MiniLM-L12-v2.gguf/resolve/main/paraphrase-multilingual-MiniLM-L12-118M-v2-Q4_K_M.gguf',
  sizeBytes: 124835104,
  sha256: '',
  contextLength: 512,
  minRamBytes: Math.round(0.5 * GB),
  embedSpecialTokens: { prefix: '<s>', suffix: '</s>' },
  note:
    'Embedding (M8), 384-dim multilingual. Replaces multilingual-e5-small: ' +
    'e5 is XLM-RoBERTa-based, which the bundled llama.cpp cannot map ' +
    '(degenerate constant vectors — verified in phase 9). MiniLM is plain ' +
    'BERT architecture and fully supported.',
};

/** Registry lookup with a helpful error. */
export function getModelSpec(id: string): ModelSpec {
  const spec = MODEL_REGISTRY.find((entry) => entry.id === id);
  if (!spec) {
    throw new Error(`Unknown model id '${id}' (registry has ${MODEL_REGISTRY.length} entries)`);
  }
  return spec;
}

/** Models whose RAM requirement fits the device (sorted: best fit first). */
export function compatibleModels(totalRamBytes: number): ModelSpec[] {
  return [...MODEL_REGISTRY].sort((a, b) => a.minRamBytes - b.minRamBytes);
}

/** The recommended model for a device: the largest that fits, else the smallest. */
export function recommendedModel(totalRamBytes: number): ModelSpec {
  const fitting = MODEL_REGISTRY.filter((spec) => spec.minRamBytes <= totalRamBytes);
  if (fitting.length === 0) {
    return MODEL_REGISTRY[MODEL_REGISTRY.length - 1]; // smallest (llama-3b, 4 GB)
  }
  return fitting.sort((a, b) => b.contextLength - a.contextLength)[0];
}
