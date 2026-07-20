import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/core/theme';

/**
 * Markdown editor with wiki-link autocomplete (M11, PRD M11): typing [[
 * opens suggestions from existing concept names + note titles; tapping one
 * inserts [[Name]] at the cursor.
 */
export interface LinkSuggestionSource {
  titles: string[];
}

export function MarkdownEditor({
  value,
  onChangeText,
  onBlur,
  placeholder,
  suggestions,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  suggestions: LinkSuggestionSource;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const [cursor, setCursor] = useState(0);

  const open = useMemo(() => findOpenWikiLink(value, cursor), [value, cursor]);
  const matches = useMemo(() => {
    if (!open) return [];
    const query = open.fragment.toLowerCase();
    return suggestions.titles.filter((title) => title.toLowerCase().includes(query)).slice(0, 6);
  }, [open, suggestions]);

  const insertSuggestion = (title: string) => {
    if (!open) return;
    const next = `${value.slice(0, open.start)}[[${title}]]${value.slice(cursor)}`;
    onChangeText(next);
  };

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(event) => setCursor(event.nativeEvent.selection.start)}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        multiline
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.input,
          theme.typography.body,
          {
            color: theme.colors.textPrimary,
            borderColor: theme.colors.lineSubtle,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.bgBase,
          },
        ]}
      />
      {open && matches.length > 0 && (
        <View
          style={[
            styles.suggestionBox,
            {
              backgroundColor: theme.colors.bgOverlay,
              borderColor: theme.colors.lineSubtle,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          {matches.map((title) => (
            <Pressable
              key={title}
              onPress={() => insertSuggestion(title)}
              accessibilityRole="button"
              accessibilityLabel={`Link einfügen: ${title}`}
              style={({ pressed }) => [
                styles.suggestionRow,
                {
                  minHeight: theme.touchTarget.default,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressed ? theme.colors.bgElevated : 'transparent',
                },
              ]}
            >
              <Text style={[theme.typography.body, { color: theme.colors.info }]}>[[{title}]]</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Cursor sits inside an unfinished [[fragment — returns its position + fragment. */
export function findOpenWikiLink(
  text: string,
  cursor: number,
): { start: number; fragment: string } | null {
  const before = text.slice(0, cursor);
  const openIndex = before.lastIndexOf('[[');
  if (openIndex < 0) return null;
  const between = before.slice(openIndex + 2);
  if (between.includes(']]') || between.includes('\n')) return null;
  return { start: openIndex, fragment: between };
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  suggestionBox: {
    borderWidth: 1,
    marginTop: 4,
    padding: 4,
    gap: 2,
  },
  suggestionRow: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
