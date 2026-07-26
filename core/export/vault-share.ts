import * as FileSystem from 'expo-file-system/legacy';

import type { Db } from '@/core/db/repositories';

import { buildVaultZip } from './vault';

/**
 * Builds the vault ZIP in the cache dir and opens the OS share sheet
 * (expo-sharing). iOS/Android only — web export lands with phase 11.
 * expo-sharing is imported lazily — it is not linked on tvOS (phase 12).
 */
export async function shareVaultZip(db: Db): Promise<string> {
  const bytes = await buildVaultZip(db);
  const path = `${FileSystem.cacheDirectory}youtube-buddy-vault.zip`;
  await FileSystem.writeAsStringAsync(path, toBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/zip',
      dialogTitle: 'Obsidian Vault exportieren',
    });
  }
  return path;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}
