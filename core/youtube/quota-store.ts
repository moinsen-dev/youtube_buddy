import { eq } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import { quotaLog } from '@/core/db/schema';

import type { QuotaStore } from './quota';

type Db = ExpoSQLiteDatabase<{ quotaLog: typeof quotaLog }>;

/** SQLite-backed quota store (quota_log table, ARCHITECTURE §4). */
export function createDbQuotaStore(db: Db): QuotaStore {
  return {
    async getUnitsUsed(day) {
      const rows = await db.select().from(quotaLog).where(eq(quotaLog.day, day)).limit(1);
      return rows[0]?.unitsUsed ?? 0;
    },
    async addUnits(day, units) {
      const current = await this.getUnitsUsed(day);
      const next = current + units;
      await db
        .insert(quotaLog)
        .values({ day, unitsUsed: next })
        .onConflictDoUpdate({ target: quotaLog.day, set: { unitsUsed: next } });
      return next;
    },
  };
}
