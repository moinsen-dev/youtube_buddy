/**
 * Wiki-link parser (M11, ARCHITECTURE §5.4): extracts [[targets]] from
 * Markdown bodies. Obsidian rules: [[target]], [[target|alias]] → target,
 * trimmed; duplicates removed, order of first appearance kept. Pure module
 * (no I/O) so it is unit-testable and reusable on web/native.
 */

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Unique, trimmed link targets in order of first appearance. */
export function extractWikiLinks(bodyMd: string): string[] {
  const targets: string[] = [];
  const seen = new Set<string>();
  for (const match of bodyMd.matchAll(WIKI_LINK_RE)) {
    const target = match[1].trim();
    const key = target.toLowerCase();
    if (target.length > 0 && !seen.has(key)) {
      seen.add(key);
      targets.push(target);
    }
  }
  return targets;
}

/** Case-insensitive match key used by the resolver (concept names/titles). */
export function linkKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Splits a rendered body into text/link segments for UI rendering — the UI
 * styles links (resolved = info color, unresolved = tertiary + dashed).
 */
export type BodySegment = { kind: 'text'; text: string } | { kind: 'link'; target: string };

export function splitBodySegments(bodyMd: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  for (const match of bodyMd.matchAll(WIKI_LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: 'text', text: bodyMd.slice(last, index) });
    segments.push({ kind: 'link', target: match[1].trim() });
    last = index + match[0].length;
  }
  if (last < bodyMd.length) segments.push({ kind: 'text', text: bodyMd.slice(last) });
  return segments;
}
