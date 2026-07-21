import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';

import { AnalysisSheet } from './analysis-sheet';
import { ChapterList } from './chapter-list';
import { SummaryPanel } from './summary-panel';
import { TriageBadge } from './triage-badge';
import { useAnalysis } from './use-analysis';

/**
 * AnalysisSection (M5, DESIGN 5.4): "Analysieren" CTA (enabled from 30 %
 * watched, ARCHITECTURE §5.1), progress sheet while running, then triage
 * badge + summary panel + chapter list with player seeks.
 */
export function AnalysisSection({
  videoId,
  title,
  durationSec,
  percentWatched,
  positionSec,
  onSeek,
}: {
  videoId: string;
  title: string;
  durationSec: number;
  percentWatched: number;
  positionSec?: number;
  onSeek: (startSec: number) => void;
}) {
  const theme = useTheme();
  const analysis = useAnalysis(videoId);
  const unlocked = percentWatched >= 0.3;
  // Complete only when all three kinds exist — a triage from the home batch
  // alone still leaves the full analysis (summary + chapters) to be run here.
  const complete =
    analysis.status === 'ready' && analysis.summary != null && analysis.chapters != null;

  const ctaHint = !analysis.engineReady
    ? 'Erst ein Modell im Mehr-Tab laden.'
    : !unlocked
      ? 'Verfügbar ab 30 % geschaut.'
      : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.lineSubtle,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>Analyse</Text>

      {!complete && (
        <View style={styles.ctaBlock}>
          <Pressable
            onPress={() => void analysis.start({ title, durationSec })}
            disabled={!analysis.engineReady || !unlocked || analysis.status === 'running'}
            accessibilityRole="button"
            accessibilityLabel="Video analysieren"
            style={({ pressed }) => [
              styles.cta,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed
                  ? theme.colors.accentPrimaryStrong
                  : theme.colors.accentPrimary,
                opacity:
                  !analysis.engineReady || !unlocked || analysis.status === 'running' ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
              {analysis.triage
                ? `Vollständig analysieren (${analysis.isCloud ? 'Cloud' : 'lokal'})`
                : `Analysieren (${analysis.isCloud ? 'Cloud' : 'lokal'})`}
            </Text>
          </Pressable>
          {ctaHint && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              {ctaHint}
            </Text>
          )}
          {analysis.error && (
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
              {analysis.error}
            </Text>
          )}
        </View>
      )}

      {analysis.status === 'ready' && analysis.triage && (
        <View style={styles.triageRow}>
          <TriageBadge score={analysis.triage.score} />
          <View style={styles.triageText}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              Lohnt sich: {analysis.triage.score}/5 · {analysis.triage.category} · Nutzen/Minute:{' '}
              {analysis.triage.density}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {analysis.triage.reason}
            </Text>
          </View>
        </View>
      )}

      {analysis.status === 'ready' && analysis.summary && (
        <SummaryPanel summary={analysis.summary} onSeek={onSeek} />
      )}

      {analysis.status === 'ready' &&
        analysis.chapters &&
        analysis.chapters.chapters.length > 0 && (
          <View style={styles.chaptersBlock}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              KAPITEL
            </Text>
            <ChapterList
              chapters={analysis.chapters.chapters}
              activeSec={positionSec}
              onSeek={onSeek}
            />
          </View>
        )}

      <AnalysisSheet
        visible={analysis.status === 'running'}
        progress={analysis.progress}
        modelName={analysis.modelName}
        isCloud={analysis.isCloud}
        onAbort={analysis.abort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 12,
  },
  ctaBlock: {
    gap: 8,
    alignItems: 'flex-start',
  },
  cta: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  triageRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  triageText: {
    flex: 1,
    gap: 2,
  },
  chaptersBlock: {
    gap: 6,
  },
});
