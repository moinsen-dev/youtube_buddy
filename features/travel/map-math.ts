/**
 * Slippy-map math (M7): lon/lat ↔ world pixels/tiles at integer zooms.
 * Pure + unit-tested — shared by native (react-native-svg overlay) and web.
 */

export interface Point {
  x: number;
  y: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export const TILE_SIZE = 256;

/** lon/lat (degrees) → world pixel at zoom (Web-Mercator). */
export function lonLatToWorld({ lat, lon }: LatLon, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  };
}

/** World pixel at zoom → lon/lat (degrees). */
export function worldToLonLat({ x, y }: Point, zoom: number): LatLon {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

/** Tiles covering a viewport rect (world pixels), clamped to the valid range. */
export function tilesForView(
  view: { x: number; y: number; width: number; height: number },
  zoom: number,
): { tileX: number; tileY: number; offsetX: number; offsetY: number }[] {
  const max = 2 ** zoom - 1;
  const tiles: { tileX: number; tileY: number; offsetX: number; offsetY: number }[] = [];
  const x0 = Math.max(0, Math.floor(view.x / TILE_SIZE));
  const y0 = Math.max(0, Math.floor(view.y / TILE_SIZE));
  const x1 = Math.min(max, Math.floor((view.x + view.width) / TILE_SIZE));
  const y1 = Math.min(max, Math.floor((view.y + view.height) / TILE_SIZE));
  for (let tileY = y0; tileY <= y1; tileY += 1) {
    for (let tileX = x0; tileX <= x1; tileX += 1) {
      tiles.push({
        tileX,
        tileY,
        offsetX: tileX * TILE_SIZE - view.x,
        offsetY: tileY * TILE_SIZE - view.y,
      });
    }
  }
  return tiles;
}

export interface MapViewState {
  zoom: number;
  /** World-pixel position of the viewport's top-left corner. */
  view: { x: number; y: number; width: number; height: number };
}

/** Fits zoom + viewport so all points are visible with padding. */
export function fitToPoints(
  points: LatLon[],
  viewWidth: number,
  viewHeight: number,
  paddingPx = 40,
): MapViewState {
  const fallback: MapViewState = {
    zoom: 2,
    view: { x: 0, y: 0, width: viewWidth, height: viewHeight },
  };
  if (points.length === 0) return fallback;

  for (let zoom = 18; zoom >= 1; zoom -= 1) {
    const pixels = points.map((point) => lonLatToWorld(point, zoom));
    const minX = Math.min(...pixels.map((p) => p.x));
    const maxX = Math.max(...pixels.map((p) => p.x));
    const minY = Math.min(...pixels.map((p) => p.y));
    const maxY = Math.max(...pixels.map((p) => p.y));
    const spanX = maxX - minX + 2 * paddingPx;
    const spanY = maxY - minY + 2 * paddingPx;
    if (spanX <= viewWidth && spanY <= viewHeight) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      return {
        zoom,
        view: {
          x: centerX - viewWidth / 2,
          y: centerY - viewHeight / 2,
          width: viewWidth,
          height: viewHeight,
        },
      };
    }
  }
  return fallback;
}

export function osmTileUrl(tileX: number, tileY: number, zoom: number): string {
  return `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
}
