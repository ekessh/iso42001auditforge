// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';

export const billingEntries = pgTable(
  'billing_entries',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    auditorId: uuid('auditor_id'),
    billableAmount: numeric('billable_amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    description: text('description'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
    createdAt: createdAt(),
  },
  (t) => ({
    ixFirm: index('billing_entries_firm_ix').on(t.firmId),
  }),
);
