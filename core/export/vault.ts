import JSZip from 'jszip';

import type { NoteRow, Db } from '@/core/db/repositories';
import { listAllNotes, getVideo } from '@/core/db/repositories';

/**
 * Obsidian vault export (M11, PRD M11): notes become .md files with YAML
 * frontmatter in a folder structure (Konzepte/, Guides/, Summaries/…);
 * wiki-links stay [[...]] syntax. Built in-memory (jszip), zipped by the
 * caller (see vault-share.ts).
 */

const TYPE_FOLDERS: Record<string, string> = {
  concept: 'Konzepte',
  guide: 'Guides',
  summary: 'Summaries',
  flashcard_set: 'Karten',
  habit: 'Habits',
  trip: 'Reisen',
  free: 'Notizen',
};

/** Filesystem-safe file name (Obsidian/Windows/macOS safe). */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'untitled';
}

export interface VaultFile {
  path: string;
  content: string;
}

export function buildFrontmatter(note: NoteRow, videoTitle: string | null): string {
  const lines = [
    '---',
    `title: "${note.title.replace(/"/g, '\\"')}"`,
    `type: ${note.type}`,
    note.videoId ? `video: https://youtu.be/${note.videoId}` : null,
    videoTitle ? `source: "[[Video: ${videoTitle.replace(/"/g, '\\"')}]]"` : null,
    `created: ${new Date(note.createdAt).toISOString()}`,
    `updated: ${new Date(note.updatedAt).toISOString()}`,
    `tags: [youtube-buddy, ${note.type}]`,
    '---',
  ];
  return lines.filter((line): line is string => line != null).join('\n');
}

export async function buildVaultFiles(db: Db): Promise<VaultFile[]> {
  const allNotes = await listAllNotes(db, 1000);
  const files: VaultFile[] = [];
  const usedPaths = new Set<string>();

  for (const note of allNotes) {
    const folder = TYPE_FOLDERS[note.type] ?? 'Notizen';
    const videoTitle = note.videoId ? ((await getVideo(db, note.videoId))?.title ?? null) : null;
    let path = `${folder}/${sanitizeFileName(note.title)}.md`;
    let suffix = 2;
    while (usedPaths.has(path)) {
      path = `${folder}/${sanitizeFileName(note.title)}-${suffix}.md`;
      suffix += 1;
    }
    usedPaths.add(path);
    files.push({
      path,
      content: `${buildFrontmatter(note, videoTitle)}\n\n${note.bodyMd}\n`,
    });
  }
  return files;
}

export async function buildVaultZip(db: Db): Promise<Uint8Array> {
  const files = await buildVaultFiles(db);
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
