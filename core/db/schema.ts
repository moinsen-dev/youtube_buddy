import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Initial schema — cross-cutting tables only (ARCHITECTURE.md §4,
 * "M9/Querschnitt"). Feature tables arrive with their phases (M1 in phase 1,
 * M2 in phase 2, …) as additional migrations.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const quotaLog = sqliteTable('quota_log', {
  day: text('day').primaryKey(),
  unitsUsed: integer('units_used').notNull().default(0),
});
