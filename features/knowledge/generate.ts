import type { LLMEngine } from '@/core/ai-engine/types';
import { flashcardsV1, flashcardsV1Schema } from '@/core/ai-engine/prompts/flashcards.v1';
import { habitsV1, habitsV1Schema } from '@/core/ai-engine/prompts/habits.v1';
import { howtoV1, howtoV1Schema } from '@/core/ai-engine/prompts/howto.v1';
import type { SummarizeReduceV1Output } from '@/core/ai-engine/prompts/summarize-reduce.v1';
import type { Db } from '@/core/db/repositories';
import {
  getAnalysis,
  insertFlashcards,
  insertGuide,
  insertHabits,
  insertNote,
} from '@/core/db/repositories';
import { defaultLocale } from '@/core/i18n/strings';

import { initialSrsState } from '../flashcards/srs';

/**
 * Knowledge generation (M6, ARCHITECTURE §5.3): turns a video's summary
 * analysis into flashcards, habits and a step-by-step guide — each persisted
 * in its table plus a companion notes row (M11 link target).
 */

export interface KnowledgeResult {
  flashcards: number;
  habits: number;
  guideId: number | null;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

export async function generateKnowledge(
  engine: LLMEngine,
  db: Db,
  videoId: string,
  videoTitle: string,
  signal?: AbortSignal,
): Promise<KnowledgeResult> {
  const analysisRow = await getAnalysis(db, videoId, 'summary');
  if (!analysisRow) {
    throw new Error('Keine Analyse vorhanden — erst „Analysieren" ausführen.');
  }
  const summary = JSON.parse(analysisRow.payload) as SummarizeReduceV1Output;
  const now = Date.now();

  throwIfAborted(signal);
  const cardsResult = await engine.generate({
    template: flashcardsV1,
    input: {
      title: videoTitle,
      language: defaultLocale,
      tldr: summary.tldr,
      keyPoints: summary.keyPoints,
    },
    schema: flashcardsV1Schema,
    signal,
  });

  throwIfAborted(signal);
  const habitsResult = await engine.generate({
    template: habitsV1,
    input: {
      title: videoTitle,
      language: defaultLocale,
      tldr: summary.tldr,
      keyPoints: summary.keyPoints,
    },
    schema: habitsV1Schema,
    signal,
  });

  throwIfAborted(signal);
  const howtoResult = await engine.generate({
    template: howtoV1,
    input: {
      title: videoTitle,
      language: defaultLocale,
      tldr: summary.tldr,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
    },
    schema: howtoV1Schema,
    signal,
  });

  // Companion notes (ARCHITECTURE §5.3 — link targets for M11).
  const cardNoteId = await insertNote(db, {
    videoId,
    conceptId: null,
    type: 'flashcard_set',
    title: `Karten: ${videoTitle}`,
    bodyMd: cardsResult.data.cards.map((card) => `- **${card.front}** — ${card.back}`).join('\n'),
    createdAt: now,
    updatedAt: now,
  });
  await insertFlashcards(
    db,
    cardsResult.data.cards.map((card) => {
      const srs = initialSrsState();
      return {
        videoId,
        noteId: cardNoteId,
        front: card.front,
        back: card.back,
        sourceSec: Math.round(card.sourceSec),
        ease: srs.ease,
        intervalDays: srs.intervalDays,
        dueAt: now, // new cards are due immediately
        reps: srs.reps,
        createdAt: now,
      };
    }),
  );

  const habitNoteId = await insertNote(db, {
    videoId,
    conceptId: null,
    type: 'habit',
    title: `Gewohnheiten: ${videoTitle}`,
    bodyMd: habitsResult.data.habits
      .map((habit) => `- **${habit.title}** — _${habit.cue}_`)
      .join('\n'),
    createdAt: now,
    updatedAt: now,
  });
  await insertHabits(
    db,
    habitsResult.data.habits.map((habit) => ({
      videoId,
      noteId: habitNoteId,
      title: habit.title,
      cue: habit.cue,
      active: 1,
      createdAt: now,
    })),
  );

  const guide = howtoResult.data;
  const guideNoteId = await insertNote(db, {
    videoId,
    conceptId: null,
    type: 'guide',
    title: guide.title,
    bodyMd: [
      ...guide.steps.map((step) => `${step.nr}. ${step.text} _(${formatSec(step.sourceSec)})_`),
      '',
      ...guide.materials.map((material) => `- [ ] ${material.name}`),
    ].join('\n'),
    createdAt: now,
    updatedAt: now,
  });
  const guideId = await insertGuide(db, {
    videoId,
    noteId: guideNoteId,
    title: guide.title,
    payload: JSON.stringify(guide),
    progressStep: 0,
    createdAt: now,
    updatedAt: now,
  });

  return {
    flashcards: cardsResult.data.cards.length,
    habits: habitsResult.data.habits.length,
    guideId,
  };
}

function formatSec(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
