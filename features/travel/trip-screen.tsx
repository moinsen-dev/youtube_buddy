import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/core/db';
import {
  getSetting,
  getTrip,
  getVideo,
  listTripPlaces,
  updateTripPlace,
  type TripPlaceRow,
  type TripRow,
} from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { formatTimestamp } from '@/features/analysis/chapter-list';

import { MapView } from './map-view';
import type { LatLon } from './map-math';

/**
 * Trip screen (M7, DESIGN 5.8): map with route polyline + numbered pins,
 * ordered place list with video jumps, manual pinning (offline path),
 * geocoding opt-in badge.
 */
export function TripScreen({ tripId }: { tripId: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [places, setPlaces] = useState<TripPlaceRow[]>([]);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [pinningPlaceId, setPinningPlaceId] = useState<number | null>(null);
  const [geocodingOptIn, setGeocodingOptIn] = useState(false);

  const reload = useCallback(async () => {
    const db = await getDb();
    if (!db) return;
    const row = await getTrip(db, tripId);
    if (!row) return;
    setTrip(row);
    const rows = await listTripPlaces(db, tripId);
    setPlaces(rows);
    setGeocodingOptIn((await getSetting(db, 'geocoding_opt_in')) === 'true');
    const first = rows[0];
    if (first) {
      const video = await getVideo(db, first.videoId);
      setVideoTitle(video?.title ?? null);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onMapPress = useCallback(
    async (point: LatLon) => {
      if (pinningPlaceId == null) return;
      const db = await getDb();
      if (!db) return;
      await updateTripPlace(db, pinningPlaceId, {
        lat: point.lat,
        lon: point.lon,
        geocodeStatus: 'manual',
      });
      setPinningPlaceId(null);
      await reload();
    },
    [pinningPlaceId, reload],
  );

  const mapped = places.filter((place) => place.lat != null && place.lon != null);

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
          <Text
            style={[theme.typography.title2, { color: theme.colors.textPrimary }]}
            numberOfLines={2}
          >
            {trip?.title ?? 'Reise'}
          </Text>
          {videoTitle && (
            <Text
              style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              aus: {videoTitle}
            </Text>
          )}
        </View>
      </View>

      {mapped.length > 0 ? (
        <MapView
          places={mapped.map((place) => ({
            lat: place.lat!,
            lon: place.lon!,
            position: place.position,
          }))}
          onMapPress={onMapPress}
        />
      ) : (
        <View
          style={[
            styles.emptyMap,
            { borderColor: theme.colors.lineSubtle, borderRadius: theme.radius.lg },
          ]}
        >
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Noch keine Koordinaten —{' '}
            {geocodingOptIn
              ? 'Geocoding fehlgeschlagen.'
              : 'Orte manuell auf der Karte setzen (📍).'}
          </Text>
        </View>
      )}

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: geocodingOptIn ? theme.colors.warning : theme.colors.success },
          ]}
        />
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {geocodingOptIn
            ? 'Geocoding: Online (Opt-in) — Nominatim/OSM + Karten-Tiles'
            : 'Geocoding: Offline — Orte per Tap manuell setzen'}
        </Text>
      </View>

      {pinningPlaceId != null && (
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentPrimary }]}>
          Jetzt den Ort auf der Karte antippen…
        </Text>
      )}

      <Text style={[theme.typography.caption, styles.label, { color: theme.colors.textSecondary }]}>
        ROUTE
      </Text>
      {places.map((place) => (
        <View key={place.id} style={styles.placeRow}>
          <View style={[styles.positionCircle, { backgroundColor: theme.colors.accentPrimary }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.accentOnPrimary }]}>
              {place.position + 1}
            </Text>
          </View>
          <View style={styles.placeText}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
              {place.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              {place.geocodeStatus === 'ok'
                ? 'geocoded'
                : place.geocodeStatus === 'manual'
                  ? 'manuell gesetzt'
                  : place.geocodeStatus === 'failed'
                    ? 'nicht gefunden'
                    : 'ohne Koordinaten'}
            </Text>
          </View>
          {place.lat == null && (
            <Pressable
              onPress={() => setPinningPlaceId(place.id)}
              accessibilityRole="button"
              accessibilityLabel={`${place.name} manuell auf der Karte setzen`}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  minHeight: theme.touchTarget.default,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                },
              ]}
            >
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>📍</Text>
            </Pressable>
          )}
          {place.sourceSec != null && (
            <Pressable
              onPress={() => router.push(`/video/${place.videoId}?t=${place.sourceSec}`)}
              accessibilityRole="button"
              accessibilityLabel={`Im Video ansehen ab ${formatTimestamp(place.sourceSec)}`}
              style={({ pressed }) => [
                styles.timestampChip,
                {
                  borderColor: theme.colors.lineSubtle,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressed ? theme.colors.bgOverlay : 'transparent',
                },
              ]}
            >
              <Text style={[theme.typography.mono, { color: theme.colors.info }]}>
                {formatTimestamp(place.sourceSec)}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  emptyMap: {
    borderWidth: 1,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    marginTop: 8,
    letterSpacing: 1,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  positionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    flex: 1,
    gap: 1,
  },
  iconButton: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  timestampChip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
