// SPDX-License-Identifier: BUSL-1.1
import { customType, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { archivedAt, createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => 'bytea',
});

export const workingPapers = pgTable(
  'working_papers',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    title: text('title').notNull(),
    verdict: text('verdict'),
    body: jsonb('body').notNull().default({}),
    crdtState: bytea('crdt_state'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (t) => ({
    ixEngagement: index('working_papers_engagement_ix').on(t.engagementId),
  }),
);

export const wpObservations = pgTable(
  'wp_observations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    workingPaperId: uuid('working_paper_id')
      .notNull()
      .references(() => workingPapers.id, { onDelete: 'cascade' }),
    observation: text('observation').notNull(),
    severity: text('severity'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixWp: index('wp_observations_wp_ix').on(t.workingPaperId),
  }),
);

export const workingPaperSnapshots = pgTable(
  'working_paper_snapshots',
  {
    workingPaperId: uuid('working_paper_id')
      .primaryKey()
      .references(() => workingPapers.id, { onDelete: 'cascade' }),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    snapshot: bytea('snapshot').notNull(),
    contentHash: text('content_hash').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    ixFirm: index('working_paper_snapshots_firm_ix').on(t.firmId, t.engagementId),
  }),
);

export const workingPaperUpdates = pgTable(
  'working_paper_updates',
  {
    id: idColumn(),
    workingPaperId: uuid('working_paper_id')
      .notNull()
      .references(() => workingPapers.id, { onDelete: 'cascade' }),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    updateBytes: bytea('update_bytes').notNull(),
    auditorId: uuid('auditor_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    ixWp: index('working_paper_updates_wp_ix').on(t.workingPaperId, t.occurredAt),
    ixFirm: index('working_paper_updates_firm_ix').on(t.firmId, t.engagementId),
  }),
);
