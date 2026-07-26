import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/core/db';
import { listAnalyses } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';

import { tvType } from './tv-type';

interface TriagePayload {
  score?: number;
  category?: string;
  density?: string;
  reason?: string;
}

interface SummaryPayload {
  tldr?: string;
  keyPoints?: { text: string }[];
}

interface ChaptersPayload {
  chapters?: { title: string; startSec: number }[];
}

/**
 * TV analysis read view (phase 12, ROADMAP: "Analyse-Leseansicht"): shows the
 * locally stored triage/summary/chapters of a video — read-only, no player,
 * no generation on TV (PRD §7.3).
 */
export function TVAnalysis({ videoId, title }: { videoId: string; title: string | null }) {
  const theme = useTheme();
  const [triage, setTriage] = useState<TriagePayload | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [chapters, setChapters] = useState<ChaptersPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      if (!db) return;
      const rows = await listAnalyses(db, videoId);
      if (cancelled) return;
      const byKind = new Map(rows.map((row) => [row.kind, row.payload]));
      if (byKind.has('triage')) setTriage(JSON.parse(byKind.get('triage')!));
      if (byKind.has('summary')) setSummary(JSON.parse(byKind.get('summary')!));
      if (byKind.has('chapters')) setChapters(JSON.parse(byKind.get('chapters')!));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text
        style={[tvType(theme.typography.title2), { color: theme.colors.textPrimary }]}
        numberOfLines={2}
      >
        {title ?? videoId}
      </Text>

      {triage?.score !== undefined && (
        <Text style={[tvType(theme.typography.bodyStrong), { color: theme.colors.accentPrimary }]}>
          Lohnt sich: {triage.score}/5{triage.category ? ` · ${triage.category}` : ''}
          {triage.density ? ` · Nutzen/Minute: ${triage.density}` : ''}
        </Text>
      )}
      {triage?.reason && (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textSecondary }]}>
          {triage.reason}
        </Text>
      )}

      {summary?.tldr && (
        <>
          <Text
            style={[
              tvType(theme.typography.title3),
              styles.section,
              { color: theme.colors.textPrimary },
            ]}
          >
            ZUSAMMENFASSUNG
          </Text>
          <Text style={[tvType(theme.typography.body), { color: theme.colors.textPrimary }]}>
            {summary.tldr}
          </Text>
        </>
      )}
      {summary?.keyPoints && summary.keyPoints.length > 0 && (
        <View style={styles.points}>
          {summary.keyPoints.map((point, i) => (
            <Text
              key={i}
              style={[tvType(theme.typography.body), { color: theme.colors.textSecondary }]}
            >
              • {point.text}
            </Text>
          ))}
        </View>
      )}

      {chapters?.chapters && chapters.chapters.length > 0 && (
        <>
          <Text
            style={[
              tvType(theme.typography.title3),
              styles.section,
              { color: theme.colors.textPrimary },
            ]}
          >
            KAPITEL
          </Text>
          {chapters.chapters.map((chapter, i) => (
            <View key={i} style={styles.chapterRow}>
              <Text style={[tvType(theme.typography.mono), { color: theme.colors.info }]}>
                {formatSec(chapter.startSec)}
              </Text>
              <Text
                style={[
                  tvType(theme.typography.body),
                  styles.chapterTitle,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {chapter.title}
              </Text>
            </View>
          ))}
        </>
      )}

      {loaded && !triage && !summary && !chapters && (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textTertiary }]}>
          Keine Analyse vorhanden — analysiere das Video auf einem anderen Gerät.
        </Text>
      )}
    </ScrollView>
  );
}

function formatSec(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 20, paddingBottom: 48 },
  section: { letterSpacing: 1.5, marginTop: 16 },
  points: { gap: 12 },
  chapterRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  chapterTitle: { flex: 1 },
});
