// SPDX-License-Identifier: BUSL-1.1
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const auditReports = pgTable(
  'audit_reports',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    reportType: text('report_type').notNull(),
    state: text('state').notNull().default('draft'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
  },
  (t) => ({
    ixEngagement: index('audit_reports_engagement_ix').on(t.engagementId),
  }),
);

export const peerReviews = pgTable(
  'peer_reviews',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    reviewerId: uuid('reviewer_id'),
    verdict: text('verdict').notNull().default('pending'),
    comments: text('comments'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => ({
    ixEngagement: index('peer_reviews_engagement_ix').on(t.engagementId),
  }),
);
