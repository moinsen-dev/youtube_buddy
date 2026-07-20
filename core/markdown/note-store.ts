import { sql, eq } from 'drizzle-orm';

import type { Db, NoteRow } from '@/core/db/repositories';
import {
  getConcept,
  getConceptByName,
  getNote,
  insertNote,
  listBacklinks,
  replaceNoteLinks,
  updateNoteBody,
} from '@/core/db/repositories';
import { concepts, notes } from '@/core/db/schema';
import { extractWikiLinks, linkKey } from './wiki-links';
import { resolveBodyLinks, rewriteLinkInBody, type LinkLookup } from './resolver';

/**
 * Note store (M11, ARCHITECTURE §5.4): every note write goes through here so
 * note_links always mirrors body_md (insert/update → parse → resolve →
 * replace links). Concept renames rewrite affected bodies and re-resolve.
 */
export function createLinkLookup(db: Db): LinkLookup {
  return {
    async findConceptNoteId(normalizedName) {
      const concept = await getConceptByName(db, normalizedName);
      return concept?.noteId ?? null;
    },
    async findNoteIdByTitle(title) {
      const rows = await db
        .select({ id: notes.id })
        .from(notes)
        .where(sql`lower(${notes.title}) = lower(${title})`)
        .limit(1);
      return rows[0]?.id ?? null;
    },
  };
}

export async function saveNoteWithLinks(db: Db, row: Omit<NoteRow, 'id'>): Promise<number> {
  const id = await insertNote(db, row);
  const links = await resolveBodyLinks(row.bodyMd, createLinkLookup(db), id);
  await replaceNoteLinks(db, id, links);
  return id;
}

export async function updateNoteBodyWithLinks(db: Db, id: number, bodyMd: string): Promise<void> {
  await updateNoteBody(db, id, bodyMd, Date.now());
  const links = await resolveBodyLinks(bodyMd, createLinkLookup(db), id);
  await replaceNoteLinks(db, id, links);
}

/**
 * Renames a concept: updates concepts + its note title, rewrites [[old]]
 * links in all affected bodies and re-resolves them (ROADMAP Phase 7 exit).
 */
export async function renameConcept(
  db: Db,
  conceptId: number,
  newDisplayName: string,
): Promise<void> {
  const concept = await getConcept(db, conceptId);
  if (!concept) return;
  const oldName = concept.displayName;
  const newName = linkKey(newDisplayName);
  const now = Date.now();

  await db
    .update(concepts)
    .set({ name: newName, displayName: newDisplayName })
    .where(eq(concepts.id, conceptId));

  if (concept.noteId != null) {
    await db
      .update(notes)
      .set({ title: newDisplayName, updatedAt: now })
      .where(eq(notes.id, concept.noteId));
  }

  // Rewrite [[old]] in every note that linked to the old name (resolved
  // backlinks, plus bodies containing the literal link text).
  const affected = new Set<number>();
  if (concept.noteId != null) {
    for (const backlink of await listBacklinks(db, concept.noteId)) {
      affected.add(backlink.id);
    }
  }
  const allLinks = await db
    .select({ srcNoteId: notes.id })
    .from(notes)
    .where(sql`lower(${notes.bodyMd}) LIKE ${'%[[' + oldName.toLowerCase() + '%]%'}`);
  for (const row of allLinks) affected.add(row.srcNoteId);

  for (const noteId of affected) {
    const note = await getNote(db, noteId);
    if (!note) continue;
    const rewritten = rewriteLinkInBody(note.bodyMd, oldName, newDisplayName);
    if (rewritten !== note.bodyMd) {
      await updateNoteBodyWithLinks(db, noteId, rewritten);
    }
  }
}

export { extractWikiLinks, linkKey };
