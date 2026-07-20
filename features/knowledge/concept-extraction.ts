import { eq } from 'drizzle-orm';

import type { LLMEngine } from '@/core/ai-engine/types';
import {
  extractConceptsV1,
  extractConceptsV1Schema,
} from '@/core/ai-engine/prompts/extract-concepts.v1';
import type { SummarizeReduceV1Output } from '@/core/ai-engine/prompts/summarize-reduce.v1';
import type { Db } from '@/core/db/repositories';
import {
  getAnalysis,
  getConceptByName,
  getNote,
  getNoteForVideo,
  getVideo,
  insertConcept,
  listConcepts,
} from '@/core/db/repositories';
import { notes } from '@/core/db/schema';
import { defaultLocale } from '@/core/i18n/strings';
import { linkKey } from '@/core/markdown/wiki-links';
import { saveNoteWithLinks, updateNoteBodyWithLinks } from '@/core/markdown/note-store';

/**
 * Concept extraction (M11, ARCHITECTURE §5.4): runs after a video analysis —
 * ensures the 'summary' note exists, then extracts recurring concepts with
 * dedup against the existing list and links everything via note bodies
 * (which keeps note_links consistent via the note-store pipeline).
 */
export async function extractConceptsForVideo(
  engine: LLMEngine,
  db: Db,
  videoId: string,
): Promise<{ created: number; linked: number }> {
  const analysisRow = await getAnalysis(db, videoId, 'summary');
  if (!analysisRow) return { created: 0, linked: 0 };
  const summary = JSON.parse(analysisRow.payload) as SummarizeReduceV1Output;
  const video = await getVideo(db, videoId);
  const now = Date.now();

  // 1) Summary note (source for the concept links).
  const noteTitle = `Summary: ${video?.title ?? videoId}`;
  const body = [
    summary.tldr,
    '',
    summary.summary,
    '',
    '## Key Points',
    ...summary.keyPoints.map(
      (point) =>
        `- ${point.text} (${point.sourceRefs.map((ref) => `${Math.floor(ref.startSec / 60)}:${String(Math.floor(ref.startSec % 60)).padStart(2, '0')}`).join(', ')})`,
    ),
  ].join('\n');
  const existingNote = await getNoteForVideo(db, videoId, 'summary');
  const noteId = existingNote
    ? (await updateNoteBodyWithLinks(db, existingNote.id, body), existingNote.id)
    : await saveNoteWithLinks(db, {
        videoId,
        conceptId: null,
        type: 'summary',
        title: noteTitle,
        bodyMd: body,
        createdAt: now,
        updatedAt: now,
      });

  // 2) Concept extraction with dedup against existing names.
  const existing = await listConcepts(db);
  const result = await engine.generate({
    template: extractConceptsV1,
    input: {
      title: video?.title ?? videoId,
      language: defaultLocale,
      tldr: summary.tldr,
      keyPoints: summary.keyPoints,
      existingConcepts: existing.map((concept) => concept.displayName),
    },
    schema: extractConceptsV1Schema,
  });

  let created = 0;
  const linkedNames: string[] = [];
  for (const item of result.data.concepts) {
    const normalized = linkKey(item.name);
    let concept = await getConceptByName(db, normalized);
    if (!concept) {
      const conceptNoteId = await saveNoteWithLinks(db, {
        videoId: null,
        conceptId: null,
        type: 'concept',
        title: item.name,
        bodyMd: `${item.description}\n\n## Quellen\n- [[${noteTitle}]]`,
        createdAt: now,
        updatedAt: now,
      });
      const conceptId = await insertConcept(db, {
        name: normalized,
        displayName: item.name,
        noteId: conceptNoteId,
        createdAt: now,
      });
      await db.update(notes).set({ conceptId }).where(eq(notes.id, conceptNoteId));
      created += 1;
      concept = await getConceptByName(db, normalized);
    } else if (concept.noteId != null) {
      const conceptNote = await getNote(db, concept.noteId);
      if (conceptNote && !conceptNote.bodyMd.includes(`[[${noteTitle}]]`)) {
        await updateNoteBodyWithLinks(
          db,
          conceptNote.id,
          `${conceptNote.bodyMd}\n- [[${noteTitle}]]`,
        );
      }
    }
    linkedNames.push(concept?.displayName ?? item.name);
  }

  // 3) The summary note links back to its concepts.
  if (linkedNames.length > 0) {
    const current = await getNote(db, noteId);
    if (current) {
      const base = current.bodyMd.replace(/\n\n## Konzepte[\s\S]*$/, '');
      const section = `\n\n## Konzepte\n${linkedNames.map((name) => `- [[${name}]]`).join('\n')}`;
      await updateNoteBodyWithLinks(db, noteId, base + section);
    }
  }

  return { created, linked: linkedNames.length };
}
