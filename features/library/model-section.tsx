import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme';
import { hasWebGPU, WEBGPU_FALLBACK_HINT } from '@/core/platform/webgpu';
import type { ModelEntry } from '@/core/ai-engine/use-model-manager';
import { useModelManager } from '@/core/ai-engine/use-model-manager';
import { WebModelSection } from './web-model-section';

/**
 * Model management section for "Mehr" (M4, DESIGN 5.11): model rows with
 * size/RAM/status, download/load/delete actions, free storage, smoke test.
 * On web without WebGPU this becomes the read-only hint (M10, phase 11).
 */
export function ModelSection() {
  const theme = useTheme();
  const {
    entries,
    freeBytes,
    recommended,
    smoke,
    bench,
    download,
    load,
    unload,
    remove,
    runSmokeTest,
    abortSmokeTest,
    runBench,
  } = useModelManager();

  if (Platform.OS === 'web') {
    // WebGPU: WebLLM lifecycle; without it the documented read-only hint.
    if (!hasWebGPU()) {
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
            KI-Modelle (lokal)
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {WEBGPU_FALLBACK_HINT}
          </Text>
        </View>
      );
    }
    return <WebModelSection />;
  }

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
        KI-Modelle (lokal)
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        Freier Speicher: {formatBytes(freeBytes)}
      </Text>

      {entries.map((entry) => (
        <ModelRow
          key={entry.spec.id}
          entry={entry}
          recommended={entry.spec.id === recommended.id}
          onDownload={() => void download(entry.spec)}
          onLoad={() => void load(entry.spec)}
          onUnload={() => void unload()}
          onDelete={() => void remove(entry.spec)}
        />
      ))}

      <View style={styles.smokeRow}>
        {smoke.running ? (
          <Pressable
            onPress={abortSmokeTest}
            accessibilityRole="button"
            accessibilityLabel="Generierung abbrechen"
            style={({ pressed }) => [
              styles.smokeButton,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.danger,
                backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.danger }]}>
              Abbrechen
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void runSmokeTest()}
            disabled={!entries.some((e) => e.status === 'loaded')}
            accessibilityRole="button"
            accessibilityLabel="Engine-Smoke-Test"
            style={({ pressed }) => [
              styles.smokeButton,
              {
                minHeight: theme.touchTarget.default,
                borderRadius: theme.radius.md,
                backgroundColor: pressed
                  ? theme.colors.accentPrimaryStrong
                  : theme.colors.accentPrimary,
                opacity: !entries.some((e) => e.status === 'loaded') ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentOnPrimary }]}>
              Smoke-Test (ping.v1)
            </Text>
          </Pressable>
        )}
        {smoke.result && (
          <Text style={[theme.typography.caption, { color: theme.colors.success }]}>
            ✓ {JSON.stringify(smoke.result.output)} · {smoke.result.tokensPerSecond.toFixed(1)}{' '}
            Tok/s · {(smoke.result.durationMs / 1000).toFixed(1)} s
            {smoke.result.repaired ? ' · repaired' : ''}
          </Text>
        )}
        {smoke.error && (
          <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
            {smoke.error}
          </Text>
        )}
      </View>

      <View style={styles.smokeRow}>
        <Pressable
          onPress={() => void runBench()}
          disabled={bench.running || !entries.some((e) => e.status === 'loaded')}
          accessibilityRole="button"
          accessibilityLabel="Benchmark starten"
          style={({ pressed }) => [
            styles.smokeButton,
            {
              minHeight: theme.touchTarget.default,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.colors.bgOverlay : theme.colors.bgOverlay,
              borderColor: theme.colors.lineSubtle,
              borderWidth: 1,
              opacity: bench.running || !entries.some((e) => e.status === 'loaded') ? 0.5 : 1,
            },
          ]}
        >
          {bench.running ? (
            <ActivityIndicator color={theme.colors.accentPrimary} size="small" />
          ) : (
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              Benchmark (summarize.v1 × 10)
            </Text>
          )}
        </Pressable>
        {bench.running && bench.progress && (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            läuft… {bench.progress}
          </Text>
        )}
        {bench.result && (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            valid: {(bench.result.validRate * 100).toFixed(0)} % · repaired:{' '}
            {(bench.result.repairedRate * 100).toFixed(0)} % · Ø{' '}
            {bench.result.avgTokensPerSecond.toFixed(1)} Tok/s · gesamt{' '}
            {(bench.result.totalDurationMs / 1000).toFixed(0)} s
          </Text>
        )}
        {bench.result?.sample && (
          <Text
            style={[theme.typography.caption, { color: theme.colors.textTertiary }]}
            numberOfLines={3}
          >
            Sample: {bench.result.sample.tldr}
          </Text>
        )}
        {bench.error && (
          <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
            {bench.error}
          </Text>
        )}
      </View>
    </View>
  );
}

function ModelRow({
  entry,
  recommended,
  onDownload,
  onLoad,
  onUnload,
  onDelete,
}: {
  entry: ModelEntry;
  recommended: boolean;
  onDownload: () => void;
  onLoad: () => void;
  onUnload: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const { spec, status, progress, error } = entry;

  const statusLabel =
    status === 'loaded'
      ? '✓ installiert'
      : status === 'downloaded'
        ? '● geladen (Datei)'
        : status === 'downloading'
          ? `lädt ${(progress * 100).toFixed(0)} %`
          : status === 'error'
            ? 'Fehler'
            : recommended
              ? 'empfohlen'
              : '—';

  return (
    <View style={[styles.row, { borderTopColor: theme.colors.lineSubtle }]}>
      <View style={styles.rowText}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
          {spec.name}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {formatBytes(spec.sizeBytes)} · RAM ≥ {formatBytes(spec.minRamBytes)} ·{' '}
          <Text
            style={{
              color: status === 'loaded' ? theme.colors.success : theme.colors.textSecondary,
            }}
          >
            {statusLabel}
          </Text>
        </Text>
        {status === 'downloading' && (
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: theme.colors.bgOverlay, borderRadius: theme.radius.sm },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.accentPrimary, width: `${progress * 100}%` },
              ]}
            />
          </View>
        )}
        {error && (
          <Text
            style={[theme.typography.caption, { color: theme.colors.danger }]}
            numberOfLines={2}
          >
            {error}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {status === 'missing' && <ActionButton label="Download" onPress={onDownload} />}
        {status === 'downloaded' && <ActionButton label="Laden" onPress={onLoad} primary />}
        {status === 'loaded' && <ActionButton label="Entladen" onPress={onUnload} />}
        {status === 'error' && <ActionButton label="Retry" onPress={onDownload} />}
        {(status === 'downloaded' || status === 'missing' || status === 'error') && (
          <ActionButton label="Löschen" onPress={onDelete} danger />
        )}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
  danger,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        {
          minHeight: 36,
          borderRadius: theme.radius.sm,
          backgroundColor: primary
            ? pressed
              ? theme.colors.accentPrimaryStrong
              : theme.colors.accentPrimary
            : pressed
              ? theme.colors.bgOverlay
              : 'transparent',
          borderColor: danger ? theme.colors.danger : theme.colors.lineSubtle,
          borderWidth: primary ? 0 : 1,
        },
      ]}
    >
      <Text
        style={[
          theme.typography.caption,
          {
            color: primary
              ? theme.colors.accentOnPrimary
              : danger
                ? theme.colors.danger
                : theme.colors.textPrimary,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${bytes} B`;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 10,
  },
  row: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  rowText: {
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  smokeRow: {
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  smokeButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
});
