// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { firmIdColumn, idColumn } from './_shared.js';

export const surveillanceTelemetry = pgTable(
  'surveillance_telemetry',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    severity: text('severity').notNull().default('info'),
    payload: jsonb('payload').notNull().default({}),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixEngagement: index('surveillance_telemetry_engagement_ix').on(t.engagementId),
  }),
);
