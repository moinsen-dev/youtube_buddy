import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/core/db';
import { importBackup, type BackupDoc } from '@/core/export/backup';
import { shareBackupJson } from '@/core/export/backup-share';
import { shareVaultZip } from '@/core/export/vault-share';
import { useTheme } from '@/core/theme';

/**
 * "Daten (lokal)" card (M10, DESIGN 5.11): the file bridge between devices.
 * Native: OS share sheet for JSON backup + Obsidian vault ZIP. Web: file
 * download for both + JSON import (the Phone → Web direction, ROADMAP
 * phase 11 exit criterion). Native import needs expo-document-picker and
 * is intentionally out of scope (documented).
 */
export function DataSection() {
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: string, task: () => Promise<string>) => {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      setMessage(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, []);

  const exportJson = useCallback(async () => {
    const db = await getDb();
    if (!db) throw new Error('Keine lokale Datenbank');
    const result = await shareBackupJson(db);
    return Platform.OS === 'web' ? `Backup heruntergeladen (${result})` : 'Backup geteilt.';
  }, []);

  const exportVault = useCallback(async () => {
    const db = await getDb();
    if (!db) throw new Error('Keine lokale Datenbank');
    if (Platform.OS === 'web') {
      const { downloadVaultZip } = await import('@/core/export/backup-share.web');
      const name = await downloadVaultZip(db);
      return `Vault heruntergeladen (${name})`;
    }
    await shareVaultZip(db);
    return 'Vault geteilt.';
  }, []);

  const importJson = useCallback(async () => {
    if (Platform.OS !== 'web') throw new Error('Import ist vorerst Web-only (Phone → Web)');
    const { pickBackupFile } = await import('@/core/export/backup-share.web');
    const text = await pickBackupFile();
    if (!text) throw new Error('Keine Datei gewählt');
    const db = await getDb();
    if (!db) throw new Error('Keine lokale Datenbank');
    const report = await importBackup(db, JSON.parse(text) as BackupDoc);
    return `Importiert: ${report.rows} Zeilen in ${report.tables} Tabellen. Ansichten aktualisieren sich beim Wechsel.`;
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
        Daten (lokal)
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        Datei-Brücke zwischen Geräten (Phone ↔ Web). Alles bleibt lokal — die Datei liegt in deiner
        Hand.
      </Text>

      <Row
        label={busy === 'json' ? 'Exportiere…' : 'Backup als JSON exportieren'}
        onPress={() => void run('json', exportJson)}
        disabled={busy !== null}
      />
      <Row
        label={busy === 'vault' ? 'Exportiere…' : 'Obsidian-Vault exportieren (ZIP)'}
        onPress={() => void run('vault', exportVault)}
        disabled={busy !== null}
      />
      {Platform.OS === 'web' && (
        <Row
          label={busy === 'import' ? 'Importiere…' : 'Backup importieren (JSON)'}
          onPress={() => void run('import', importJson)}
          disabled={busy !== null}
        />
      )}

      {message && (
        <Text style={[theme.typography.caption, { color: theme.colors.success }]}>{message}</Text>
      )}
      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

function Row({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: theme.touchTarget.default,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentPrimary }]}>
        {label} ▸
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 8,
  },
  row: {
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
