/**
 * WebGPU capability check (M10, ROADMAP phase 11): gates the KI features on
 * web. Chrome/Edge ship WebGPU, Safari (stable) does not — without it the
 * app is the documented read-only mode (imported analyses/cards/notes/graph
 * stay readable, generation is hidden behind a clear hint).
 */
export function hasWebGPU(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    (navigator as { gpu?: unknown }).gpu !== undefined
  );
}

/** Hinweis-UX text for the read-only fallback (DESIGN review wording). */
export const WEBGPU_FALLBACK_HINT =
  'KI-Generierung braucht WebGPU (Chrome/Edge). In diesem Browser läuft der Read-only-Modus: importierte Analysen, Karten, Notizen und der Graph bleiben voll lesbar.';
