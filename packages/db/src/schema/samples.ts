// SPDX-License-Identifier: BUSL-1.1
import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';

export const samples = pgTable(
  'samples',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    method: text('method').notNull(),
    populationSize: integer('population_size'),
    sampleSize: integer('sample_size'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('samples_engagement_ix').on(t.engagementId),
  }),
);

export const sampleUnits = pgTable(
  'sample_units',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    sampleId: uuid('sample_id')
      .notNull()
      .references(() => samples.id, { onDelete: 'cascade' }),
    identifier: text('identifier').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixSample: index('sample_units_sample_ix').on(t.sampleId),
  }),
);
