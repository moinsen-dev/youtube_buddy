/**
 * PlayerTracker (M2, ARCHITECTURE §5.1): converts player progress events into
 * watch_sessions rows. Position writes happen at 5-second ticks; pause/end/
 * unmount finalize the session. Pure logic with an injected sink so it can be
 * unit-tested without SQLite (mirrors the migration-runner pattern).
 */

export interface WatchSessionInsert {
  videoId: string;
  startedAt: number;
  endedAt: number | null;
  positionSec: number;
  percentWatched: number;
  source: 'player' | 'manual' | 'takeout';
}

export interface WatchSessionSink {
  insert(row: WatchSessionInsert): Promise<number>;
  update(id: number, patch: Partial<Omit<WatchSessionInsert, 'videoId'>>): Promise<void>;
}

export const TICK_WRITE_INTERVAL_MS = 5000;
export const WATCHED_THRESHOLD = 0.8;

/** percent = max reached position / duration, clamped to [0, 1], 3 decimals. */
export function computePercentWatched(maxPositionSec: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.min(1, Math.round((maxPositionSec / durationSec) * 1000) / 1000);
}

export function isWatched(percentWatched: number): boolean {
  return percentWatched >= WATCHED_THRESHOLD;
}

export class PlayerTracker {
  private sessionId: number | null = null;
  private maxPositionSec = 0;
  private lastWriteAt = 0;
  private readonly now: () => number;

  constructor(
    private readonly sink: WatchSessionSink,
    now?: () => number,
  ) {
    this.now = now ?? Date.now;
  }

  get activeSessionId(): number | null {
    return this.sessionId;
  }

  /** Starts a new session (e.g. when the player is ready). */
  async start(videoId: string, positionSec: number): Promise<void> {
    this.maxPositionSec = Math.max(0, Math.floor(positionSec));
    this.lastWriteAt = this.now();
    this.sessionId = await this.sink.insert({
      videoId,
      startedAt: this.lastWriteAt,
      endedAt: null,
      positionSec: this.maxPositionSec,
      percentWatched: 0,
      source: 'player',
    });
  }

  /** Called by the player (~1/s); persists at 5-s ticks (ARCHITECTURE §5.1). */
  async tick(positionSec: number, durationSec: number): Promise<void> {
    if (this.sessionId === null) return;
    this.maxPositionSec = Math.max(this.maxPositionSec, Math.floor(positionSec));
    const now = this.now();
    if (now - this.lastWriteAt < TICK_WRITE_INTERVAL_MS) return;
    this.lastWriteAt = now;
    await this.sink.update(this.sessionId, {
      positionSec: Math.floor(positionSec),
      percentWatched: computePercentWatched(this.maxPositionSec, durationSec),
    });
  }

  async pause(positionSec: number, durationSec: number): Promise<void> {
    await this.finalize(positionSec, durationSec);
  }

  async end(positionSec: number, durationSec: number): Promise<void> {
    await this.finalize(positionSec, durationSec);
  }

  /** Screen unmounts or user navigates away. */
  async stop(positionSec: number, durationSec: number): Promise<void> {
    await this.finalize(positionSec, durationSec);
  }

  private async finalize(positionSec: number, durationSec: number): Promise<void> {
    if (this.sessionId === null) return;
    this.maxPositionSec = Math.max(this.maxPositionSec, Math.floor(positionSec));
    await this.sink.update(this.sessionId, {
      endedAt: this.now(),
      positionSec: Math.floor(positionSec),
      percentWatched: computePercentWatched(this.maxPositionSec, durationSec),
    });
    this.sessionId = null;
  }
}
