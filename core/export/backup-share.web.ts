import type { Db } from '@/core/db/repositories';

import { buildBackup } from './backup';
import { buildVaultZip } from './vault';

/**
 * Web backup bridge (phase 11): downloads are Blob + a[download], the
 * import uses a hidden file input. No expo-file-system/sharing on web.
 */

function downloadBlob(bytes: Uint8Array | string, fileName: string, mime: string): void {
  // Fresh buffer copy: jszip's Uint8Array may sit on a SharedArrayBuffer
  // or pooled view, which Blob's typings reject.
  const part = typeof bytes === 'string' ? bytes : new Uint8Array(bytes).buffer;
  const blob = new Blob([part], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads the full JSON backup. */
export async function shareBackupJson(db: Db): Promise<string> {
  const doc = await buildBackup(db);
  const fileName = `youtube-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
  downloadBlob(JSON.stringify(doc), fileName, 'application/json');
  return fileName;
}

/** Downloads the Obsidian vault ZIP (jszip is pure JS — works on web). */
export async function downloadVaultZip(db: Db): Promise<string> {
  const bytes = await buildVaultZip(db);
  const fileName = 'youtube-buddy-vault.zip';
  downloadBlob(bytes, fileName, 'application/zip');
  return fileName;
}

/** Opens a file picker and resolves the chosen file's text content. The
 * input is appended (invisible) so automation (CDP DOM.setFileInputFiles)
 * can address it; it is removed after the change fires. */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.onchange = async () => {
      const file = input.files?.[0];
      const text = file ? await file.text() : null;
      cleanup();
      resolve(text);
    };
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    input.click();
  });
}
