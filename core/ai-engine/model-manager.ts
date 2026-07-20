import * as FileSystem from 'expo-file-system/legacy';
import { sha256 } from 'js-sha256';
import { Platform } from 'react-native';

import type { ModelSpec } from './types';

/**
 * Model download & verification (M4, ARCHITECTURE §3.2): resumable download
 * via expo-file-system, chunked SHA-256 check, storage checks. Files live in
 * <documents>/models/<id>.gguf (excluded from OS backups, ARCHITECTURE §9).
 */

export const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

export type DownloadResult =
  | { status: 'ok'; path: string }
  | { status: 'not-enough-space'; neededBytes: number; freeBytes: number }
  | { status: 'hash-mismatch'; expected: string; actual: string }
  | { status: 'error'; message: string };

export async function modelPath(spec: ModelSpec): Promise<string> {
  return `${MODELS_DIR}${spec.id}.gguf`;
}

export async function isModelDownloaded(spec: ModelSpec): Promise<string | null> {
  if (Platform.OS === 'web') return null; // no local FS on web (WebLLM lands later)
  const path = await modelPath(spec);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

export async function freeStorageBytes(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  return FileSystem.getFreeDiskStorageAsync();
}

const HASH_CHUNK_BYTES = 8 * 1024 * 1024;

/** Streams a file through js-sha256 in chunks (no 2.5 GB memory spike). */
export async function hashFileSha256(path: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) throw new Error(`hashFileSha256: '${path}' does not exist`);
  const size = info.size ?? 0;
  const hasher = sha256.create();
  let offset = 0;
  while (offset < size) {
    const length = Math.min(HASH_CHUNK_BYTES, size - offset);
    const base64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    hasher.update(bytes);
    offset += length;
  }
  return hasher.hex();
}

/**
 * Downloads a model with resume + progress. Verifies SHA-256 when the
 * registry has one pinned.
 */
export async function downloadModel(
  spec: ModelSpec,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<DownloadResult> {
  const free = await freeStorageBytes();
  if (free < spec.sizeBytes) {
    return { status: 'not-enough-space', neededBytes: spec.sizeBytes, freeBytes: free };
  }

  await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true }).catch(() => {});
  const path = await modelPath(spec);
  const tempPath = `${path}.download`;

  const task = FileSystem.createDownloadResumable(spec.url, tempPath, {}, (progress) => {
    const expected = progress.totalBytesExpectedToWrite || spec.sizeBytes;
    onProgress?.(progress.totalBytesWritten / expected);
  });

  try {
    if (signal) {
      signal.addEventListener('abort', () => void task.cancelAsync(), { once: true });
    }
    const existing = await FileSystem.getInfoAsync(tempPath);
    const result = await (existing.exists ? task.resumeAsync() : task.downloadAsync());

    if (!result || signal?.aborted) {
      return { status: 'error', message: signal?.aborted ? 'aborted' : 'download failed' };
    }

    if (spec.sha256) {
      const actual = await hashFileSha256(tempPath);
      if (actual.toLowerCase() !== spec.sha256.toLowerCase()) {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        return { status: 'hash-mismatch', expected: spec.sha256, actual };
      }
    }

    await FileSystem.moveAsync({ from: tempPath, to: path });
    return { status: 'ok', path };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteModel(spec: ModelSpec): Promise<void> {
  const path = await modelPath(spec);
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.deleteAsync(`${path}.download`, { idempotent: true });
}

export async function modelFileSizeBytes(path: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? (info.size ?? 0) : 0;
}
