import * as FileSystem from 'expo-file-system/legacy';

import type { Db } from '@/core/db/repositories';

import { buildBackup } from './backup';

/**
 * Native backup share (phase 11): writes the JSON backup to the cache dir
 * and opens the OS share sheet (Airdrop/Drive/… → lands on the desktop for
 * the web import). Web resolves backup-share.web.ts instead (download).
 * expo-sharing is imported lazily — it is not linked on tvOS (phase 12).
 */
export async function shareBackupJson(db: Db): Promise<string> {
  const doc = await buildBackup(db);
  const path = `${FileSystem.cacheDirectory}youtube-buddy-backup.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(doc));
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'YouTube Buddy Backup (JSON)',
    });
  }
  return path;
}
