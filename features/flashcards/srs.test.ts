import {
  computeStreak,
  initialSrsState,
  localDayKey,
  review,
  DAY_MS,
  GRADE_AGAIN,
  GRADE_EASY,
  GRADE_GOOD,
  GRADE_HARD,
} from './srs';

/**
 * SM-2 tests (M6 exit: "SM-2 plant Reviews korrekt") — simulated days:
 * the same card goes through a full schedule; grades only shift the ease.
 */

describe('sm-2 review scheduling', () => {
  const t0 = Date.UTC(2026, 6, 20, 8, 0, 0); // fixed "day 0" for determinism

  it('schedules 1 → 6 → n×e intervals for good grades', () => {
    let state = initialSrsState();

    const r1 = review(state, GRADE_GOOD, t0);
    expect(r1.intervalDays).toBe(1);
    expect(r1.reps).toBe(1);
    expect(r1.dueAt).toBe(t0 + 1 * DAY_MS);

    const r2 = review(r1, GRADE_GOOD, r1.dueAt);
    expect(r2.intervalDays).toBe(6);
    expect(r2.reps).toBe(2);

    const r3 = review(r2, GRADE_GOOD, r2.dueAt);
    expect(r3.intervalDays).toBe(Math.round(6 * r2.ease));
    expect(r3.reps).toBe(3);
    // Grade 4 leaves the ease unchanged (0.1 - 1*(0.08+0.02) = 0).
    expect(r3.ease).toBeCloseTo(2.5, 5);

    const r4 = review(r3, GRADE_GOOD, r3.dueAt);
    expect(r4.intervalDays).toBe(Math.round(r3.intervalDays * r3.ease));
  });

  it('resets to relearning on "again" and keeps ease', () => {
    const state = { ease: 2.5, intervalDays: 12, reps: 4 };
    const failed = review(state, GRADE_AGAIN, t0);
    expect(failed.reps).toBe(0);
    expect(failed.intervalDays).toBe(1);
    expect(failed.ease).toBe(2.5); // no ease change below grade 3
    // Relearned card then restarts the 1 → 6 ladder.
    const recovered = review(failed, GRADE_GOOD, failed.dueAt);
    expect(recovered.reps).toBe(1);
    expect(recovered.intervalDays).toBe(1);
  });

  it('lowers ease for hard, raises it for easy, floored at 1.3', () => {
    const hard = review({ ease: 2.5, intervalDays: 10, reps: 3 }, GRADE_HARD, t0);
    expect(hard.ease).toBeLessThan(2.5);

    const easy = review({ ease: 2.5, intervalDays: 10, reps: 3 }, GRADE_EASY, t0);
    expect(easy.ease).toBeGreaterThan(2.5);

    let state = { ease: 1.32, intervalDays: 2, reps: 2 };
    for (let i = 0; i < 5; i += 1) {
      state = review(state, GRADE_HARD, t0);
    }
    expect(state.ease).toBe(1.3); // MIN_EASE floor
  });

  it('clamps out-of-range grades', () => {
    const low = review(initialSrsState(), -2, t0);
    expect(low.reps).toBe(0);
    const high = review(initialSrsState(), 9, t0);
    expect(high.reps).toBe(1);
  });
});

describe('computeStreak', () => {
  const day = (d: number) => Date.UTC(2026, 6, d, 12, 0, 0);

  it('counts consecutive days with reviews up to today', () => {
    const reviews = [day(20), day(19), day(19), day(18), day(16)]; // gap on 17
    expect(computeStreak(reviews, day(20))).toBe(3);
  });

  it('allows a streak that has no review today yet', () => {
    const reviews = [day(19), day(18), day(17)];
    expect(computeStreak(reviews, day(20))).toBe(3);
  });

  it('returns 0 with no reviews at all', () => {
    expect(computeStreak([], day(20))).toBe(0);
  });
});

describe('localDayKey', () => {
  it('formats a local ISO day', () => {
    expect(localDayKey(Date.UTC(2026, 0, 5, 23, 59))).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
  });
});
