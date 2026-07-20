/**
 * Nominatim geocoding (M7, PRD §7.4 — Opt-in only, clearly flagged):
 * 1 request/second, descriptive User-Agent, results cached in-process
 * (place rows carry the persistent cache via geocode_status/lat/lon).
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'YouTubeBuddy/1.0 (local travel module, contact: developer@moinsen.dev)';
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;
const memoryCache = new Map<string, { lat: number; lon: number } | null>();

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Geocodes one place name; null on no-hit/network error. Never throws. */
export async function geocodePlace(name: string): Promise<GeoPoint | null> {
  const key = name.trim().toLowerCase();
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;

  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  try {
    lastRequestAt = Date.now();
    const response = await fetch(
      `${NOMINATIM_URL}?q=${encodeURIComponent(name)}&format=json&limit=1`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
    );
    if (!response.ok) {
      memoryCache.set(key, null);
      return null;
    }
    const results = (await response.json()) as { lat: string; lon: string }[];
    const hit = results[0] ? { lat: Number(results[0].lat), lon: Number(results[0].lon) } : null;
    memoryCache.set(key, hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon) ? hit : null);
    return memoryCache.get(key) ?? null;
  } catch {
    memoryCache.set(key, null);
    return null;
  }
}

/** Test helper: clears the in-process cache + rate limiter. */
export function resetGeocodingForTests(): void {
  memoryCache.clear();
  lastRequestAt = 0;
}
