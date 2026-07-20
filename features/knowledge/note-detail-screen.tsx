import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  getConceptByName,
  getNote,
  getVideo,
  listBacklinks,
  type NoteRow,
} from '@/core/db/repositories';
import { updateNoteBodyWithLinks } from '@/core/markdown/note-store';
import { splitBodySegments, linkKey } from '@/core/markdown/wiki-links';
import { useTheme } from '@/core/theme';

/**
 * Note/concept detail (M11, DESIGN 5.14): body with resolved wiki-links
 * (tappable, unresolved = tertiary), source chips, backlink panel, graph
 * entry. Free notes are editable in place (with link autocomplete).
 */
export function NoteDetailScreen({ noteId }: { noteId: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [note, setNote] = useState<NoteRow | null>(null);
  const [backlinks, setBacklinks] = useState<NoteRow[]>([]);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const db = await getDb();
        if (!db) return;
        const row = await getNote(db, noteId);
        if (cancelled || !row) return;
        setNote(row);
        setBacklinks(await listBacklinks(db, noteId));
        if (row.videoId) {
          const video = await getVideo(db, row.videoId);
          if (!cancelled) setVideoTitle(video?.title ?? null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [noteId]),
  );

  const openLink = useCallback(
    async (target: string) => {
      const db = await getDb();
      if (!db) return;
      const concept = await getConceptByName(db, linkKey(target));
      if (concept?.noteId && concept.noteId !== noteId) {
        router.push(`/notes/${concept.noteId}`);
      }
    },
    [noteId, router],
  );

  if (!note) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.bgBase, paddingTop: insets.top }]}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>…</Text>
      </View>
    );
  }

  const segments = splitBodySegments(note.bodyMd);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bgBase }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          style={{
            minHeight: theme.touchTarget.default,
            justifyContent: 'center',
            paddingRight: 12,
          }}
        >
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {note.type === 'concept' ? 'Konzept' : note.type}
          </Text>
          <Text
            style={[theme.typography.title2, { color: theme.colors.textPrimary }]}
            numberOfLines={2}
          >
            {note.title}
          </Text>
        </View>
      </View>

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
        <Text style={[theme.typography.body, styles.bodyText, { color: theme.colors.textPrimary }]}>
          {segments.map((segment, index) =>
            segment.kind === 'text' ? (
              <Text key={index}>{segment.text}</Text>
            ) : (
              <Text
                key={index}
                onPress={() => void openLink(segment.target)}
                style={[styles.link, { color: theme.colors.info }]}
                accessibilityRole="link"
              >
                {segment.target}
              </Text>
            ),
          )}
        </Text>

        {note.videoId && (
          <Pressable
            onPress={() => router.push(`/video/${note.videoId}`)}
            accessibilityRole="button"
            accessibilityLabel="Quellvideo öffnen"
            style={{ minHeight: theme.touchTarget.default, justifyContent: 'center' }}
          >
            <Text
              style={[theme.typography.caption, { color: theme.colors.info }]}
              numberOfLines={1}
            >
              🎬 {videoTitle ?? 'Video öffnen'}
            </Text>
          </Pressable>
        )}
      </View>

      {backlinks.length > 0 && (
        <View style={styles.backlinkSection}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            WIRD ERWÄHNT IN ({backlinks.length})
          </Text>
          {backlinks.map((backlink) => (
            <Pressable
              key={backlink.id}
              onPress={() => router.push(`/notes/${backlink.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Öffne ${backlink.title}`}
              style={({ pressed }) => [
                styles.backlinkRow,
                {
                  minHeight: theme.touchTarget.default,
                  borderRadius: theme.radius.md,
                  backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                },
              ]}
            >
              <Text
                style={[theme.typography.body, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
              >
                • {backlink.type}: {backlink.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => router.push('/graph')}
        accessibilityRole="button"
        accessibilityLabel="Im Wissensgraph ansehen"
        style={({ pressed }) => [
          styles.graphButton,
          {
            minHeight: theme.touchTarget.default,
            borderRadius: theme.radius.md,
            borderColor: theme.colors.lineSubtle,
            backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
          },
        ]}
      >
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
          ◉ In Graph ansehen
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    padding: 16,
    gap: 14,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  card: {
    borderWidth: 1,
    gap: 10,
  },
  bodyText: {
    lineHeight: 24,
  },
  link: {
    textDecorationLine: 'underline',
  },
  backlinkSection: {
    gap: 4,
  },
  backlinkRow: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  graphButton: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
