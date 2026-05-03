// SPDX-License-Identifier: BUSL-1.1
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const interviewRecords = pgTable(
  'interview_records',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    interviewee: text('interviewee').notNull(),
    status: text('status').notNull().default('scheduled'),
    summary: text('summary'),
    transcript: jsonb('transcript').notNull().default({}),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixEngagement: index('interview_records_engagement_ix').on(t.engagementId),
  }),
);
