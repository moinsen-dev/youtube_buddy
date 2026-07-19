import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/core/db';
import { useTheme } from '@/core/theme';
import { QUOTA_DAILY_LIMIT, quotaDayKey } from '@/core/youtube/quota';
import { createDbQuotaStore } from '@/core/youtube/quota-store';

/**
 * YouTube quota meter (DESIGN 5.11): today's units of the 10.000/day budget,
 * turning warning-colored past 80 %.
 */
export function QuotaMeter() {
  const theme = useTheme();
  const [used, setUsed] = useState<number>(0);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      if (!db) {
        if (!cancelled) setAvailable(false);
        return;
      }
      const store = createDbQuotaStore(db);
      const units = await store.getUnitsUsed(quotaDayKey());
      if (!cancelled) setUsed(units);
    })().catch(() => setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const ratio = Math.min(1, used / QUOTA_DAILY_LIMIT);
  const warn = ratio > 0.8;
  const barColor = warn ? theme.colors.warning : theme.colors.accentPrimary;

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
        YouTube-Quota
      </Text>
      <View
        style={[
          styles.track,
          { backgroundColor: theme.colors.bgOverlay, borderRadius: theme.radius.sm },
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel={`${used} von ${QUOTA_DAILY_LIMIT} Units heute`}
      >
        <View
          style={[
            styles.fill,
            { backgroundColor: barColor, borderRadius: theme.radius.sm, width: `${ratio * 100}%` },
          ]}
        />
      </View>
      <Text
        style={[
          theme.typography.caption,
          { color: warn ? theme.colors.warning : theme.colors.textSecondary },
        ]}
      >
        {used.toLocaleString('de-DE')} / {QUOTA_DAILY_LIMIT.toLocaleString('de-DE')} Units heute
        {!available ? ' · (Web: kein lokaler Zähler, Phase 1)' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 8,
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
