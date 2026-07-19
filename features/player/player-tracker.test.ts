import {
  computePercentWatched,
  isWatched,
  PlayerTracker,
  TICK_WRITE_INTERVAL_MS,
  type WatchSessionInsert,
  type WatchSessionSink,
} from './player-tracker';

function createSink() {
  const rows: (WatchSessionInsert & { id: number })[] = [];
  const sink: WatchSessionSink & { rows: typeof rows } = {
    rows,
    async insert(row) {
      const id = rows.length + 1;
      rows.push({ id, ...row });
      return id;
    },
    async update(id, patch) {
      const row = rows.find((r) => r.id === id);
      Object.assign(row!, patch);
    },
  };
  return sink;
}

describe('computePercentWatched', () => {
  it('computes max-position / duration clamped to [0, 1]', () => {
    expect(computePercentWatched(30, 100)).toBe(0.3);
    expect(computePercentWatched(150, 100)).toBe(1);
    expect(computePercentWatched(0, 100)).toBe(0);
  });

  it('returns 0 for unknown durations', () => {
    expect(computePercentWatched(50, 0)).toBe(0);
    expect(computePercentWatched(50, -10)).toBe(0);
  });
});

describe('isWatched (80% threshold, ROADMAP phase 2)', () => {
  it('marks watched at 80 % and above', () => {
    expect(isWatched(0.79)).toBe(false);
    expect(isWatched(0.8)).toBe(true);
    expect(isWatched(1)).toBe(true);
  });
});

describe('PlayerTracker', () => {
  it('starts a session with the resume position', async () => {
    const sink = createSink();
    const tracker = new PlayerTracker(sink, () => 1000);
    await tracker.start('vid1', 42);

    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]).toMatchObject({
      videoId: 'vid1',
      startedAt: 1000,
      endedAt: null,
      positionSec: 42,
      percentWatched: 0,
      source: 'player',
    });
  });

  it('writes only at 5-second ticks', async () => {
    const sink = createSink();
    let now = 0;
    const tracker = new PlayerTracker(sink, () => now);
    await tracker.start('vid1', 0);

    await tracker.tick(2, 100); // t=0, too early
    expect(sink.rows[0].percentWatched).toBe(0);

    now = TICK_WRITE_INTERVAL_MS;
    await tracker.tick(6, 100);
    expect(sink.rows[0].positionSec).toBe(6);
    expect(sink.rows[0].percentWatched).toBe(0.06);

    now = TICK_WRITE_INTERVAL_MS + 2000; // t=7s, too early for next tick
    await tracker.tick(8, 100);
    expect(sink.rows[0].percentWatched).toBe(0.06);
  });

  it('tracks max position for percent but current position for resume', async () => {
    const sink = createSink();
    let now = 0;
    const tracker = new PlayerTracker(sink, () => now);
    await tracker.start('vid1', 0);

    now = 5000;
    await tracker.tick(80, 100); // user reaches 80 %
    now = 10000;
    await tracker.tick(30, 100); // user rewinds to 30 %
    expect(sink.rows[0].positionSec).toBe(30);
    expect(sink.rows[0].percentWatched).toBe(0.8);
    expect(isWatched(sink.rows[0].percentWatched)).toBe(true);
  });

  it('finalizes on pause with endedAt', async () => {
    const sink = createSink();
    let now = 0;
    const tracker = new PlayerTracker(sink, () => now);
    await tracker.start('vid1', 0);
    now = 3000;
    await tracker.tick(10, 200);
    now = 9000;
    await tracker.pause(12, 200);

    expect(sink.rows[0].endedAt).toBe(9000);
    expect(sink.rows[0].positionSec).toBe(12);
    expect(sink.rows[0].percentWatched).toBe(0.06);
    expect(tracker.activeSessionId).toBeNull();
  });

  it('ignores ticks after finalize', async () => {
    const sink = createSink();
    const tracker = new PlayerTracker(sink, () => 0);
    await tracker.start('vid1', 0);
    await tracker.end(50, 100);
    await tracker.tick(60, 100);
    expect(sink.rows[0].positionSec).toBe(50);
  });
});
