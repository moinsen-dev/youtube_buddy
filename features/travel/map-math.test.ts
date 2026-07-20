import { fitToPoints, lonLatToWorld, osmTileUrl, tilesForView, worldToLonLat } from './map-math';

describe('lonLatToWorld / worldToLonLat', () => {
  it('round-trips a coordinate', () => {
    const world = lonLatToWorld({ lat: 35.6812, lon: 139.7671 }, 12); // Tokyo
    const back = worldToLonLat(world, 12);
    expect(back.lat).toBeCloseTo(35.6812, 4);
    expect(back.lon).toBeCloseTo(139.7671, 4);
  });

  it('maps lon 0 to the horizontal center', () => {
    expect(lonLatToWorld({ lat: 0, lon: 0 }, 1).x).toBe(256);
  });
});

describe('tilesForView', () => {
  it('covers the viewport with tiles and clamps at 0', () => {
    const tiles = tilesForView({ x: -10, y: -10, width: 300, height: 300 }, 3);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles.every((tile) => tile.tileX >= 0 && tile.tileY >= 0)).toBe(true);
  });
});

describe('fitToPoints', () => {
  it('centers the view on the point set', () => {
    const state = fitToPoints(
      [
        { lat: 35.68, lon: 139.77 },
        { lat: 35.01, lon: 135.77 },
      ],
      400,
      400,
    );
    expect(state.zoom).toBeGreaterThan(2);
    const center = worldToLonLat({ x: state.view.x + 200, y: state.view.y + 200 }, state.zoom);
    expect(center.lat).toBeGreaterThan(34);
    expect(center.lat).toBeLessThan(37);
  });

  it('returns a fallback for empty input', () => {
    expect(fitToPoints([], 400, 400).zoom).toBe(2);
  });
});

describe('osmTileUrl', () => {
  it('builds the OSM tile URL', () => {
    expect(osmTileUrl(3, 4, 5)).toBe('https://tile.openstreetmap.org/5/3/4.png');
  });
});
