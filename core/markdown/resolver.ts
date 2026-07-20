import { extractWikiLinks, linkKey } from './wiki-links';

/**
 * Link resolver (M11, ARCHITECTURE §5.4): maps [[targets]] to note ids.
 * Order: concepts (normalized name) → note title (case-insensitive).
 * Unresolved targets stay as resolved=0 rows (Obsidian-style). The lookup
 * is injected so the mapping is unit-testable without a database.
 */

export interface LinkLookup {
  /** Returns the concept's note id for a normalized name, else null. */
  findConceptNoteId(normalizedName: string): Promise<number | null>;
  /** Returns the note id for an exact title (case-insensitive), else null. */
  findNoteIdByTitle(title: string): Promise<number | null>;
}

export interface ResolvedLink {
  dstNoteId: number | null;
  dstConceptName: string;
  resolved: number;
}

export async function resolveTargets(
  targets: string[],
  lookup: LinkLookup,
  selfNoteId?: number,
): Promise<ResolvedLink[]> {
  const links: ResolvedLink[] = [];
  for (const target of targets) {
    const conceptNoteId = await lookup.findConceptNoteId(linkKey(target));
    if (conceptNoteId != null && conceptNoteId !== selfNoteId) {
      links.push({ dstNoteId: conceptNoteId, dstConceptName: target, resolved: 1 });
      continue;
    }
    const noteId = await lookup.findNoteIdByTitle(target);
    if (noteId != null && noteId !== selfNoteId) {
      links.push({ dstNoteId: noteId, dstConceptName: target, resolved: 1 });
      continue;
    }
    links.push({ dstNoteId: conceptNoteId, dstConceptName: target, resolved: 0 });
  }
  return links;
}

export async function resolveBodyLinks(
  bodyMd: string,
  lookup: LinkLookup,
  selfNoteId?: number,
): Promise<ResolvedLink[]> {
  return resolveTargets(extractWikiLinks(bodyMd), lookup, selfNoteId);
}

/**
 * Rewrites all [[oldTarget]] (case-insensitive, alias-preserving) in a body
 * to [[newTarget]] — used when a concept/note is renamed (ROADMAP Phase 7
 * exit: renames update links).
 */
export function rewriteLinkInBody(bodyMd: string, oldTarget: string, newTarget: string): string {
  const escaped = oldTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[\\[\\s*${escaped}\\s*(\\|[^\\]]*)?\\]\\]`, 'gi');
  return bodyMd.replace(re, (_match, alias: string | undefined) =>
    alias ? `[[${newTarget}${alias}]]` : `[[${newTarget}]]`,
  );
}
