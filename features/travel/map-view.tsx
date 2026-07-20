import React, { useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/core/theme';

import {
  fitToPoints,
  lonLatToWorld,
  osmTileUrl,
  tilesForView,
  worldToLonLat,
  type LatLon,
} from './map-math';

const OSM_USER_AGENT = 'YouTubeBuddy/1.0 (local travel module, contact: developer@moinsen.dev)';

/** Tile fetch with explicit UA + persistent disk cache (OSM policy-friendly). */
function useTileUri(tileX: number, tileY: number, zoom: number): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const path = `${FileSystem.cacheDirectory}osm/${zoom}/${tileX}/${tileY}.png`;
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          if (!cancelled) setUri(path);
          return;
        }
        await FileSystem.makeDirectoryAsync(path.split('/').slice(0, -1).join('/'), {
          intermediates: true,
        }).catch(() => {});
        const result = await FileSystem.downloadAsync(osmTileUrl(tileX, tileY, zoom), path, {
          headers: { 'User-Agent': OSM_USER_AGENT },
        });
        if (!cancelled && result.status === 200) setUri(result.uri);
      } catch {
        // tile stays blank — pins/route still render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tileX, tileY, zoom]);
  return uri;
}

function Tile({
  tileX,
  tileY,
  zoom,
  left,
  top,
}: {
  tileX: number;
  tileY: number;
  zoom: number;
  left: number;
  top: number;
}) {
  const uri = useTileUri(tileX, tileY, zoom);
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={[styles.tile, { left, top }]}
      accessibilityLabel="Kartenkachel"
    />
  );
}

/**
 * Map view (M7, DESIGN 5.8): OSM raster tiles + SVG overlay (route polyline
 * + numbered pins) via slippy-map math. No native module required — works
 * identically on native and web. Tap → lon/lat for manual pinning.
 */
export interface MapPlace extends LatLon {
  position: number;
}

export function MapView({
  places,
  onMapPress,
  height = 320,
}: {
  places: MapPlace[];
  onMapPress?: (point: LatLon) => void;
  height?: number;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const viewWidth = Math.min(width - 32, 900);

  const state = useMemo(() => fitToPoints(places, viewWidth, height), [places, viewWidth, height]);
  const tiles = useMemo(() => tilesForView(state.view, state.zoom), [state]);

  const pixelOf = (point: LatLon) => {
    const world = lonLatToWorld(point, state.zoom);
    return { x: world.x - state.view.x, y: world.y - state.view.y };
  };

  const polylinePoints = places
    .map((place) => {
      const pixel = pixelOf(place);
      return `${pixel.x},${pixel.y}`;
    })
    .join(' ');

  const handlePress = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!onMapPress) return;
    const { locationX, locationY } = event.nativeEvent;
    onMapPress(
      worldToLonLat({ x: locationX + state.view.x, y: locationY + state.view.y }, state.zoom),
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel="Karte — tippen, um einen Ort manuell zu setzen"
      style={[
        styles.container,
        { borderRadius: theme.radius.lg, borderColor: theme.colors.lineSubtle, height },
      ]}
    >
      {tiles.map((tile) => (
        <Tile
          key={`${tile.tileX}/${tile.tileY}`}
          tileX={tile.tileX}
          tileY={tile.tileY}
          zoom={state.zoom}
          left={tile.offsetX}
          top={tile.offsetY}
        />
      ))}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        {places.length > 1 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={theme.colors.info}
            strokeWidth={2.5}
          />
        )}
        {places.map((place) => {
          const pixel = pixelOf(place);
          return (
            <React.Fragment key={place.position}>
              <Circle
                cx={pixel.x}
                cy={pixel.y}
                r={13}
                fill={theme.colors.accentPrimary}
                stroke={theme.colors.bgBase}
                strokeWidth={2}
              />
              <SvgText
                x={pixel.x}
                y={pixel.y + 4}
                fontSize={12}
                fontWeight="bold"
                fill={theme.colors.accentOnPrimary}
                textAnchor="middle"
              >
                {place.position + 1}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.attribution}>
        <Text style={[theme.typography.caption, styles.attributionText]}>
          © OpenStreetMap-Mitwirkende
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: '#0F1115',
  },
  tile: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
  },
  attributionText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
  },
});
