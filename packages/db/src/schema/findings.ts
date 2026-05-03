// SPDX-License-Identifier: BUSL-1.1
import { date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const findings = pgTable(
  'findings',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    findingType: text('finding_type').notNull(),
    findingState: text('finding_state').notNull().default('draft'),
    title: text('title').notNull(),
    description: text('description'),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixEngagement: index('findings_engagement_ix').on(t.engagementId),
  }),
);

export const candidateFindings = pgTable(
  'candidate_findings',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    status: text('status').notNull().default('pending'),
    rationale: text('rationale'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixEngagement: index('candidate_findings_engagement_ix').on(t.engagementId),
  }),
);

export const correctiveActions = pgTable(
  'corrective_actions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    findingId: uuid('finding_id')
      .notNull()
      .references(() => findings.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    state: text('state').notNull().default('proposed'),
    dueDate: date('due_date'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixFinding: index('corrective_actions_finding_ix').on(t.findingId),
  }),
);
