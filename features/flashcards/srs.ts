/**
 * SM-2 spaced repetition (M6, ARCHITECTURE §5.3): pure functions, no I/O.
 * The review UI maps its four buttons to grades: Nochmal=1, Schwer=3,
 * Gut=4, Leicht=5 (DESIGN 5.6).
 */

export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
}

export interface SrsResult extends SrsState {
  dueAt: number;
}

export const MIN_EASE = 1.3;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const GRADE_AGAIN = 1;
export const GRADE_HARD = 3;
export const GRADE_GOOD = 4;
export const GRADE_EASY = 5;

export function initialSrsState(): SrsState {
  return { ease: 2.5, intervalDays: 0, reps: 0 };
}

/** Applies SM-2 for a grade 0–5 at `now` (ms) and returns the next schedule. */
export function review(state: SrsState, grade: number, now: number): SrsResult {
  const q = Math.max(0, Math.min(5, Math.round(grade)));
  let { ease, intervalDays, reps } = state;

  if (q >= 3) {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
    ease = Math.max(MIN_EASE, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  } else {
    reps = 0;
    intervalDays = 1;
  }

  return { ease, intervalDays, reps, dueAt: now + intervalDays * DAY_MS };
}

/**
 * Consecutive-day streak ending today/yesterday: counts how many distinct
 * local days with reviews chain backwards from `now` (a gap ends the streak).
 */
export function computeStreak(reviewedAts: number[], now: number): number {
  const days = new Set(reviewedAts.map((ts) => localDayKey(ts)));
  let streak = 0;
  let cursor = new Date(now);
  // Today may not have a review yet — allow the streak to start yesterday.
  if (!days.has(localDayKey(cursor.getTime()))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  while (days.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
