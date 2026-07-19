import type { QuotaStore } from './quota';

/**
 * In-memory quota store — fallback for web, where phase 1 has no local DB
 * (web persistence is decided in phase 11).
 */
export function createMemoryQuotaStore(): QuotaStore {
  const used = new Map<string, number>();
  return {
    async getUnitsUsed(day) {
      return used.get(day) ?? 0;
    },
    async addUnits(day, units) {
      const next = (used.get(day) ?? 0) + units;
      used.set(day, next);
      return next;
    },
  };
}
