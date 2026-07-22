import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getEngine, peekEngine } from '@/core/ai-engine/engine-instance';
import { EMBEDDING_MODEL_SPEC, getModelSpec } from '@/core/ai-engine/model-registry';
import { useTheme } from '@/core/theme';

/**
 * Web model management (M10, phase 11): loads the chat model (WebLLM,
 * ~2,5 GB, browser-cached) and the embedding model (transformers.js,
 * ~120 MB) with progress. WebLLM/transformers.js handle their own
 * download caches — there is no FileSystem path like on native.
 */
export function WebModelSection() {
  const theme = useTheme();
  const [chatState, setChatState] = useState<'missing' | 'loading' | 'loaded' | 'error'>(() =>
    peekEngine()?.loadedModelId ? 'loaded' : 'missing',
  );
  const [chatPct, setChatPct] = useState(0);
  const [embState, setEmbState] = useState<'missing' | 'loading' | 'loaded' | 'error'>(() =>
    peekEngine()?.loadedEmbeddingModelId === EMBEDDING_MODEL_SPEC.id ? 'loaded' : 'missing',
  );
  const [error, setError] = useState<string | null>(null);

  const loadChat = useCallback(async () => {
    setChatState('loading');
    setError(null);
    try {
      const engine = await getEngine();
      await engine.loadModel(getModelSpec('qwen3-4b-instruct-q4'), (pct) => setChatPct(pct));
      setChatState('loaded');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setChatState('error');
    }
  }, []);

  const loadEmbedding = useCallback(async () => {
    setEmbState('loading');
    setError(null);
    try {
      const engine = await getEngine();
      if (!engine.loadEmbeddingModel) throw new Error('Engine ohne Embedding-Support');
      await engine.loadEmbeddingModel(EMBEDDING_MODEL_SPEC);
      setEmbState('loaded');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setEmbState('error');
    }
  }, []);

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
      <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
        KI-Modelle (Browser, WebGPU)
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        Download einmalig — danach komplett lokal im Browser-Cache.
      </Text>

      <Row
        title="Qwen3 4B Instruct (WebLLM)"
        subtitle="~2,5 GB · Chat-Analyse im Browser"
        state={chatState}
        pct={chatPct}
        onLoad={() => void loadChat()}
      />
      <Row
        title="MiniLM Multilingual (transformers.js)"
        subtitle="~120 MB · semantische Suche"
        state={embState}
        pct={null}
        onLoad={() => void loadEmbedding()}
      />

      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

function Row({
  title,
  subtitle,
  state,
  pct,
  onLoad,
}: {
  title: string;
  subtitle: string;
  state: 'missing' | 'loading' | 'loaded' | 'error';
  pct: number | null;
  onLoad: () => void;
}) {
  const theme = useTheme();
  const label =
    state === 'loaded'
      ? '● geladen'
      : state === 'loading'
        ? pct !== null
          ? `Lädt… ${Math.round(pct * 100)} %`
          : 'Lädt…'
        : state === 'error'
          ? 'Fehler — erneut versuchen'
          : 'Laden';
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <Pressable
        onPress={onLoad}
        disabled={state === 'loaded' || state === 'loading'}
        accessibilityRole="button"
        accessibilityLabel={`${title} laden`}
        style={({ pressed }) => [
          styles.button,
          {
            minHeight: theme.touchTarget.default,
            borderRadius: theme.radius.md,
            backgroundColor:
              state === 'loaded' || state === 'loading'
                ? theme.colors.lineSubtle
                : pressed
                  ? theme.colors.accentPrimaryStrong
                  : theme.colors.accentPrimary,
          },
        ]}
      >
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
