import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/core/db';
import { listTripPlaces, listTrips, type TripPlaceRow, type TripRow } from '@/core/db/repositories';
import { useTheme } from '@/core/theme';
import { MapView } from '@/features/travel/map-view';

import { tvType } from './tv-type';

/**
 * TV travel view (phase 12, ROADMAP: "Reise-Map (statisch)"): renders the
 * first trip's OSM map + numbered places — static, no pinning on TV.
 */
export function TVReisen() {
  const theme = useTheme();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [places, setPlaces] = useState<TripPlaceRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = await getDb();
      if (!db) return;
      const trips = await listTrips(db);
      const first = trips[0] ?? null;
      const tripPlaces = first ? await listTripPlaces(db, first.id) : [];
      if (cancelled) return;
      setTrip(first);
      setPlaces(tripPlaces);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {!loaded && (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textSecondary }]}>
          …
        </Text>
      )}
      {loaded && !trip && (
        <Text style={[tvType(theme.typography.body), { color: theme.colors.textTertiary }]}>
          Keine Reise vorhanden — erstelle sie auf einem anderen Gerät aus einem Reise-Video.
        </Text>
      )}
      {trip && (
        <>
          <Text style={[tvType(theme.typography.title2), { color: theme.colors.textPrimary }]}>
            {trip.title}
          </Text>
          {places.length > 0 && (
            <MapView
              places={places
                .filter((place) => place.lat !== null && place.lon !== null)
                .map((place) => ({
                  lat: place.lat!,
                  lon: place.lon!,
                  position: place.position,
                }))}
              height={540}
            />
          )}
          {places.map((place, i) => (
            <View key={place.id} style={styles.placeRow}>
              <Text style={[tvType(theme.typography.bodyStrong), { color: theme.colors.info }]}>
                {i + 1}
              </Text>
              <Text
                style={[
                  tvType(theme.typography.body),
                  styles.placeName,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {place.name}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 24, paddingBottom: 48 },
  placeRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  placeName: { flex: 1 },
});
