// SPDX-License-Identifier: BUSL-1.1
import { customType, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
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
