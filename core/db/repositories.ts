import { eq, isNull, notInArray, desc, and, inArray, lte } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import {
  analyses,
  channels,
  concepts,
  flashcardReviews,
  flashcards,
  guides,
  habitChecks,
  habits,
  noteLinks,
  notes,
  playlists,
  playlistItems,
  settings,
  subscriptions,
  tripPlaces,
  trips,
  videos,
  watchSessions,
  transcriptChunks,
  transcripts,
  type AnalysisKind,
  type GeocodeStatus,
  type NoteType,
} from '@/core/db/schema';
import type * as schema from '@/core/db/schema';

// --- transcripts (M3) ---

import type { TranscriptChunk } from '@/features/transcripts/chunker';

// --- watch_sessions (M2) ---

export type Db = ExpoSQLiteDatabase<typeof schema>;

// --- settings ---

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

// --- channels & subscriptions (M1) ---

export interface ChannelRow {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  updatedAt: number;
}

export async function upsertChannels(db: Db, rows: ChannelRow[]): Promise<void> {
  for (const row of rows) {
    await db.insert(channels).values(row).onConflictDoUpdate({ target: channels.id, set: row });
  }
}

export interface SubscriptionRow {
  channelId: string;
  subscribedAt: number;
  deletedAt: number | null;
}

export async function upsertSubscriptions(db: Db, rows: SubscriptionRow[]): Promise<void> {
  for (const row of rows) {
    await db
      .insert(subscriptions)
      .values(row)
      .onConflictDoUpdate({ target: subscriptions.channelId, set: row });
  }
}

/** Soft-deletes subscriptions that are no longer returned by the API. */
export async function markSubscriptionsDeleted(
  db: Db,
  activeChannelIds: string[],
  deletedAt: number,
): Promise<void> {
  if (activeChannelIds.length === 0) return;
  await db
    .update(subscriptions)
    .set({ deletedAt })
    .where(notInArray(subscriptions.channelId, activeChannelIds));
}

export interface SubscriptionListItem {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  subscribedAt: number;
}

export async function listActiveSubscriptions(db: Db): Promise<SubscriptionListItem[]> {
  const rows = await db
    .select({
      channelId: subscriptions.channelId,
      title: channels.title,
      thumbnailUrl: channels.thumbnailUrl,
      subscribedAt: subscriptions.subscribedAt,
    })
    .from(subscriptions)
    .innerJoin(channels, eq(subscriptions.channelId, channels.id))
    .where(isNull(subscriptions.deletedAt))
    .orderBy(channels.title);
  return rows;
}

// --- videos (M1) ---

export interface VideoRow {
  id: string;
  channelId: string;
  title: string;
  durationSec: number | null;
  publishedAt: number | null;
  thumbnailUrl: string | null;
  description: string | null;
  updatedAt: number;
}

export async function upsertVideos(db: Db, rows: VideoRow[]): Promise<void> {
  for (const row of rows) {
    await db.insert(videos).values(row).onConflictDoUpdate({ target: videos.id, set: row });
  }
}

// --- playlists (M1) ---

export interface PlaylistRow {
  id: string;
  title: string;
  itemCount: number;
  updatedAt: number;
}

export async function upsertPlaylists(db: Db, rows: PlaylistRow[]): Promise<void> {
  for (const row of rows) {
    await db.insert(playlists).values(row).onConflictDoUpdate({ target: playlists.id, set: row });
  }
}

export async function replacePlaylistItems(
  db: Db,
  playlistId: string,
  items: { videoId: string; position: number }[],
): Promise<void> {
  await db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId));
  for (const item of items) {
    await db.insert(playlistItems).values({ playlistId, ...item });
  }
}

/** Counts videos currently stored for a playlist (for list UIs). */
export async function listPlaylistVideoIds(db: Db, playlistId: string): Promise<string[]> {
  const rows = await db
    .select({ videoId: playlistItems.videoId })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position);
  return rows.map((row) => row.videoId);
}

// --- videos (M1/M2 helpers) ---

export interface VideoListItem {
  id: string;
  title: string;
  channelId: string;
  durationSec: number | null;
  thumbnailUrl: string | null;
}

export async function getVideo(db: Db, id: string): Promise<VideoListItem | null> {
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      channelId: videos.channelId,
      durationSec: videos.durationSec,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(videos)
    .where(eq(videos.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Videos of a playlist with metadata (e.g. Watch Later rail on Home). */
export async function listPlaylistVideos(
  db: Db,
  playlistId: string,
  limit = 50,
): Promise<VideoListItem[]> {
  return db
    .select({
      id: videos.id,
      title: videos.title,
      channelId: videos.channelId,
      durationSec: videos.durationSec,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(playlistItems.position)
    .limit(limit);
}

export interface WatchSessionRow {
  id: number;
  videoId: string;
  startedAt: number;
  endedAt: number | null;
  positionSec: number;
  percentWatched: number;
  source: string;
}

export async function insertWatchSession(
  db: Db,
  row: Omit<WatchSessionRow, 'id'>,
): Promise<number> {
  const result = await db.insert(watchSessions).values(row);
  return Number(result.lastInsertRowId);
}

export async function updateWatchSession(
  db: Db,
  id: number,
  patch: Partial<Omit<WatchSessionRow, 'id' | 'videoId'>>,
): Promise<void> {
  await db.update(watchSessions).set(patch).where(eq(watchSessions.id, id));
}

/** Latest session for a video — used for resume-on-reopen. */
export async function getLatestSessionForVideo(
  db: Db,
  videoId: string,
): Promise<WatchSessionRow | null> {
  const rows = await db
    .select()
    .from(watchSessions)
    .where(eq(watchSessions.videoId, videoId))
    .orderBy(desc(watchSessions.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface SessionWithVideo {
  session: WatchSessionRow;
  video: VideoListItem;
}

async function latestSessionsWithVideo(db: Db): Promise<SessionWithVideo[]> {
  const rows = await db
    .select()
    .from(watchSessions)
    .innerJoin(videos, eq(watchSessions.videoId, videos.id))
    .orderBy(desc(watchSessions.startedAt));
  const byVideo = new Map<string, SessionWithVideo>();
  for (const row of rows) {
    if (byVideo.has(row.watch_sessions.videoId)) continue;
    byVideo.set(row.watch_sessions.videoId, {
      session: row.watch_sessions,
      video: {
        id: row.videos.id,
        title: row.videos.title,
        channelId: row.videos.channelId,
        durationSec: row.videos.durationSec,
        thumbnailUrl: row.videos.thumbnailUrl,
      },
    });
  }
  return [...byVideo.values()];
}

/** "Weiterschauen" rail: open sessions below the watched threshold. */
export async function listOpenSessions(db: Db): Promise<SessionWithVideo[]> {
  const all = await latestSessionsWithVideo(db);
  return all.filter((row) => row.session.percentWatched < 0.8 && row.session.source !== 'manual');
}

/** Verlauf tab: latest session per video, newest first. */
export async function listHistory(db: Db): Promise<SessionWithVideo[]> {
  return latestSessionsWithVideo(db);
}

/** Manual "als geschaut markieren" — a full-percent row with source 'manual'. */
export async function markVideoWatched(db: Db, videoId: string, now: number): Promise<void> {
  await insertWatchSession(db, {
    videoId,
    startedAt: now,
    endedAt: now,
    positionSec: 0,
    percentWatched: 1,
    source: 'manual',
  });
}

export interface TranscriptMeta {
  videoId: string;
  lang: string | null;
  source: string | null;
  fetchedAt: number;
}

export async function getTranscriptMeta(db: Db, videoId: string): Promise<TranscriptMeta | null> {
  const rows = await db.select().from(transcripts).where(eq(transcripts.videoId, videoId)).limit(1);
  return rows[0] ?? null;
}

/** Saves a transcript: replaces meta row + all chunks in one transaction. */
export async function saveTranscript(
  db: Db,
  meta: TranscriptMeta,
  chunks: TranscriptChunk[],
): Promise<void> {
  await db.delete(transcripts).where(eq(transcripts.videoId, meta.videoId));
  await db.delete(transcriptChunks).where(eq(transcriptChunks.videoId, meta.videoId));
  await db.insert(transcripts).values(meta);
  for (const chunk of chunks) {
    await db.insert(transcriptChunks).values({
      videoId: meta.videoId,
      idx: chunk.idx,
      startSec: chunk.startSec,
      endSec: chunk.endSec,
      text: chunk.text,
    });
  }
}

export interface TranscriptChunkRow {
  idx: number;
  startSec: number;
  endSec: number;
  text: string;
}

export async function listTranscriptChunks(db: Db, videoId: string): Promise<TranscriptChunkRow[]> {
  return db
    .select({
      idx: transcriptChunks.idx,
      startSec: transcriptChunks.startSec,
      endSec: transcriptChunks.endSec,
      text: transcriptChunks.text,
    })
    .from(transcriptChunks)
    .where(eq(transcriptChunks.videoId, videoId))
    .orderBy(transcriptChunks.idx);
}

// --- analyses (M5) ---

export type { AnalysisKind };

export interface AnalysisRow {
  videoId: string;
  kind: AnalysisKind;
  model: string;
  promptVersion: string;
  /** JSON string — validate with the kind's zod schema after parsing. */
  payload: string;
  createdAt: number;
}

/** Insert or replace the analysis for (videoId, kind). */
export async function upsertAnalysis(db: Db, row: AnalysisRow): Promise<void> {
  await db
    .insert(analyses)
    .values(row)
    .onConflictDoUpdate({
      target: [analyses.videoId, analyses.kind],
      set: {
        model: row.model,
        promptVersion: row.promptVersion,
        payload: row.payload,
        createdAt: row.createdAt,
      },
    });
}

export async function getAnalysis(
  db: Db,
  videoId: string,
  kind: AnalysisKind,
): Promise<AnalysisRow | null> {
  const rows = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.videoId, videoId), eq(analyses.kind, kind)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAnalyses(db: Db, videoId: string): Promise<AnalysisRow[]> {
  return db.select().from(analyses).where(eq(analyses.videoId, videoId));
}

/** Triage payloads for a set of videos (home batch badges), keyed by videoId. */
export async function listTriageForVideos(db: Db, videoIds: string[]): Promise<AnalysisRow[]> {
  if (videoIds.length === 0) return [];
  return db
    .select()
    .from(analyses)
    .where(and(eq(analyses.kind, 'triage'), inArray(analyses.videoId, videoIds)));
}

// --- notes (M6 free notes; full M11 pipeline arrives in phase 7) ---

export interface NoteRow {
  id: number;
  videoId: string | null;
  conceptId: number | null;
  type: NoteType;
  title: string;
  bodyMd: string;
  createdAt: number;
  updatedAt: number;
}

export async function insertNote(db: Db, row: Omit<NoteRow, 'id'>): Promise<number> {
  const result = await db.insert(notes).values(row);
  return Number(result.lastInsertRowId);
}

export async function updateNoteBody(
  db: Db,
  id: number,
  bodyMd: string,
  updatedAt: number,
): Promise<void> {
  await db.update(notes).set({ bodyMd, updatedAt }).where(eq(notes.id, id));
}

export async function getNoteForVideo(
  db: Db,
  videoId: string,
  type: NoteType,
): Promise<NoteRow | null> {
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.videoId, videoId), eq(notes.type, type)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRecentNotes(db: Db, limit = 10): Promise<NoteRow[]> {
  return db.select().from(notes).orderBy(desc(notes.updatedAt)).limit(limit);
}

// --- flashcards (M6) ---

export interface FlashcardRow {
  id: number;
  videoId: string;
  noteId: number | null;
  front: string;
  back: string;
  sourceSec: number | null;
  ease: number;
  intervalDays: number;
  dueAt: number;
  reps: number;
  createdAt: number;
}

export async function insertFlashcards(db: Db, rows: Omit<FlashcardRow, 'id'>[]): Promise<void> {
  for (const row of rows) {
    await db.insert(flashcards).values(row);
  }
}

export async function listFlashcardsForVideo(db: Db, videoId: string): Promise<FlashcardRow[]> {
  return db.select().from(flashcards).where(eq(flashcards.videoId, videoId));
}

export async function listDueFlashcards(db: Db, now: number, limit = 50): Promise<FlashcardRow[]> {
  return db
    .select()
    .from(flashcards)
    .where(lte(flashcards.dueAt, now))
    .orderBy(flashcards.dueAt)
    .limit(limit);
}

export async function countDueFlashcards(db: Db, now: number): Promise<number> {
  const rows = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(lte(flashcards.dueAt, now));
  return rows.length;
}

/** Applies the SM-2 result after a review (fields precomputed by features/flashcards/srs). */
export async function updateFlashcardScheduling(
  db: Db,
  cardId: number,
  patch: { ease: number; intervalDays: number; dueAt: number; reps: number },
): Promise<void> {
  await db.update(flashcards).set(patch).where(eq(flashcards.id, cardId));
}

export async function insertFlashcardReview(
  db: Db,
  row: { cardId: number; reviewedAt: number; grade: number },
): Promise<void> {
  await db.insert(flashcardReviews).values(row);
}

/** Distinct review days (for the streak counter), descending. */
export async function listReviewDays(db: Db, limit = 60): Promise<number[]> {
  const rows = await db
    .select({ reviewedAt: flashcardReviews.reviewedAt })
    .from(flashcardReviews)
    .orderBy(desc(flashcardReviews.reviewedAt))
    .limit(limit * 20);
  return rows.map((row) => row.reviewedAt);
}

// --- habits (M6) ---

export interface HabitRow {
  id: number;
  videoId: string;
  noteId: number | null;
  title: string;
  cue: string | null;
  active: number;
  createdAt: number;
}

export async function insertHabits(db: Db, rows: Omit<HabitRow, 'id'>[]): Promise<void> {
  for (const row of rows) {
    await db.insert(habits).values(row);
  }
}

export async function listActiveHabits(db: Db): Promise<HabitRow[]> {
  return db.select().from(habits).where(eq(habits.active, 1));
}

export async function setHabitCheck(
  db: Db,
  habitId: number,
  day: string,
  done: boolean,
): Promise<void> {
  await db
    .insert(habitChecks)
    .values({ habitId, day, done: done ? 1 : 0 })
    .onConflictDoUpdate({
      target: [habitChecks.habitId, habitChecks.day],
      set: { done: done ? 1 : 0 },
    });
}

export async function listHabitChecksForDay(
  db: Db,
  day: string,
): Promise<{ habitId: number; done: number }[]> {
  return db.select().from(habitChecks).where(eq(habitChecks.day, day));
}

// --- guides (M6) ---

export interface GuideRow {
  id: number;
  videoId: string;
  noteId: number | null;
  title: string;
  /** JSON payload — validate with the howto zod schema after parsing. */
  payload: string;
  progressStep: number;
  createdAt: number;
  updatedAt: number;
}

export async function insertGuide(db: Db, row: Omit<GuideRow, 'id'>): Promise<number> {
  const result = await db.insert(guides).values(row);
  return Number(result.lastInsertRowId);
}

export async function getGuide(db: Db, id: number): Promise<GuideRow | null> {
  const rows = await db.select().from(guides).where(eq(guides.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listGuides(db: Db): Promise<GuideRow[]> {
  return db.select().from(guides).orderBy(desc(guides.updatedAt));
}

export async function updateGuideProgress(
  db: Db,
  id: number,
  progressStep: number,
  updatedAt: number,
): Promise<void> {
  await db.update(guides).set({ progressStep, updatedAt }).where(eq(guides.id, id));
}

// --- concepts & note_links (M11) ---

export interface ConceptRow {
  id: number;
  name: string;
  displayName: string;
  noteId: number | null;
  createdAt: number;
}

export async function insertConcept(
  db: Db,
  row: { name: string; displayName: string; noteId: number | null; createdAt: number },
): Promise<number> {
  const result = await db
    .insert(concepts)
    .values(row)
    .onConflictDoUpdate({ target: concepts.name, set: { displayName: row.displayName } });
  const existing = await getConceptByName(db, row.name);
  return existing?.id ?? Number(result.lastInsertRowId);
}

export async function getConceptByName(db: Db, name: string): Promise<ConceptRow | null> {
  const rows = await db.select().from(concepts).where(eq(concepts.name, name)).limit(1);
  return rows[0] ?? null;
}

export async function getConcept(db: Db, id: number): Promise<ConceptRow | null> {
  const rows = await db.select().from(concepts).where(eq(concepts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listConcepts(db: Db): Promise<ConceptRow[]> {
  return db.select().from(concepts).orderBy(concepts.displayName);
}

/** Concepts with their backlink count (notes linking to the concept note). */
export async function listConceptsWithSourceCount(
  db: Db,
): Promise<(ConceptRow & { sources: number })[]> {
  const all = await listConcepts(db);
  const out: (ConceptRow & { sources: number })[] = [];
  for (const concept of all) {
    let sources = 0;
    if (concept.noteId != null) {
      const links = await db
        .select({ id: noteLinks.id })
        .from(noteLinks)
        .where(and(eq(noteLinks.dstNoteId, concept.noteId), eq(noteLinks.resolved, 1)));
      sources = links.length;
    }
    out.push({ ...concept, sources });
  }
  return out;
}

export async function updateConceptNoteId(db: Db, id: number, noteId: number): Promise<void> {
  await db.update(concepts).set({ noteId }).where(eq(concepts.id, id));
}

export interface NoteLinkRow {
  id: number;
  srcNoteId: number;
  dstNoteId: number | null;
  dstConceptName: string;
  resolved: number;
}

/** Replaces all outgoing links of a note (called on insert/update of the note). */
export async function replaceNoteLinks(
  db: Db,
  srcNoteId: number,
  links: { dstNoteId: number | null; dstConceptName: string; resolved: number }[],
): Promise<void> {
  await db.delete(noteLinks).where(eq(noteLinks.srcNoteId, srcNoteId));
  for (const link of links) {
    await db.insert(noteLinks).values({ srcNoteId, ...link });
  }
}

/** Backlinks = reverse lookup: notes that link TO this note (DESIGN 5.14). */
export async function listBacklinks(db: Db, dstNoteId: number): Promise<NoteRow[]> {
  const links = await db
    .select({ srcNoteId: noteLinks.srcNoteId })
    .from(noteLinks)
    .where(and(eq(noteLinks.dstNoteId, dstNoteId), eq(noteLinks.resolved, 1)));
  const out: NoteRow[] = [];
  for (const link of links) {
    const note = await getNote(db, link.srcNoteId);
    if (note) out.push(note);
  }
  return out;
}

export async function getNote(db: Db, id: number): Promise<NoteRow | null> {
  const rows = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listNotesByType(db: Db, type: NoteType, limit = 50): Promise<NoteRow[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.type, type))
    .orderBy(desc(notes.updatedAt))
    .limit(limit);
}

export async function listAllNotes(db: Db, limit = 500): Promise<NoteRow[]> {
  return db.select().from(notes).orderBy(desc(notes.updatedAt)).limit(limit);
}

export async function listAllNoteLinks(db: Db): Promise<NoteLinkRow[]> {
  return db.select().from(noteLinks);
}

// --- travel (M7) ---

export interface TripRow {
  id: number;
  title: string;
  noteId: number | null;
  createdAt: number;
}

export interface TripPlaceRow {
  id: number;
  tripId: number;
  videoId: string;
  name: string;
  lat: number | null;
  lon: number | null;
  sourceSec: number | null;
  position: number;
  geocodeStatus: GeocodeStatus;
}

export async function insertTrip(db: Db, row: Omit<TripRow, 'id'>): Promise<number> {
  const result = await db.insert(trips).values(row);
  return Number(result.lastInsertRowId);
}

export async function getTrip(db: Db, id: number): Promise<TripRow | null> {
  const rows = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTripForVideo(db: Db, videoId: string): Promise<TripRow | null> {
  const places = await db
    .select({ tripId: tripPlaces.tripId })
    .from(tripPlaces)
    .where(eq(tripPlaces.videoId, videoId))
    .limit(1);
  if (places.length === 0) return null;
  return getTrip(db, places[0].tripId);
}

export async function listTrips(db: Db): Promise<TripRow[]> {
  return db.select().from(trips).orderBy(desc(trips.createdAt));
}

export async function insertTripPlaces(db: Db, rows: Omit<TripPlaceRow, 'id'>[]): Promise<void> {
  for (const row of rows) {
    await db.insert(tripPlaces).values(row);
  }
}

export async function listTripPlaces(db: Db, tripId: number): Promise<TripPlaceRow[]> {
  return db
    .select()
    .from(tripPlaces)
    .where(eq(tripPlaces.tripId, tripId))
    .orderBy(tripPlaces.position);
}

export async function updateTripPlace(
  db: Db,
  id: number,
  patch: Partial<Pick<TripPlaceRow, 'lat' | 'lon' | 'geocodeStatus'>>,
): Promise<void> {
  await db.update(tripPlaces).set(patch).where(eq(tripPlaces.id, id));
}

export async function updateTripNoteId(db: Db, id: number, noteId: number): Promise<void> {
  await db.update(trips).set({ noteId }).where(eq(trips.id, id));
}
