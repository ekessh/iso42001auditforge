// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';
import { evidenceObjects } from './evidence.js';

// Bi-temporal claim graph (ADR-0009).

export const episodes = pgTable(
  'episodes',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    source: text('source').notNull(),
    payload: jsonb('payload').notNull().default({}),
    ingestionTime: timestamp('ingestion_time', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    validTimeStart: timestamp('valid_time_start', { withTimezone: true }),
    validTimeEnd: timestamp('valid_time_end', { withTimezone: true }),
  },
  (t) => ({
    ixEngagementIngestion: index('episodes_engagement_ingestion_ix').on(
      t.engagementId,
      t.ingestionTime,
    ),
  }),
);

export const claims = pgTable(
  'claims',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    predicate: text('predicate').notNull(),
    objectText: text('object_text'),
    objectUri: text('object_uri'),
    eventTimeStart: timestamp('event_time_start', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    eventTimeEnd: timestamp('event_time_end', { withTimezone: true }),
    recordTimeStart: timestamp('record_time_start', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    recordTimeEnd: timestamp('record_time_end', { withTimezone: true }),
    confidence: doublePrecision('confidence').notNull().default(1.0),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    ixEngagementWindow: index('claims_engagement_event_window_ix').on(
      t.engagementId,
      t.eventTimeStart,
      t.eventTimeEnd,
    ),
  }),
);

export const claimRelations = pgTable(
  'claim_relations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    subject: uuid('subject')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    predicate: text('predicate').notNull(),
    object: uuid('object')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixSubjectPredicate: index('claim_relations_subject_predicate_ix').on(t.subject, t.predicate),
  }),
);

export const claimAttributions = pgTable(
  'claim_attributions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    evidenceId: uuid('evidence_id').references(() => evidenceObjects.id, { onDelete: 'set null' }),
    weight: doublePrecision('weight').notNull().default(1.0),
    rationale: text('rationale'),
    createdAt: createdAt(),
  },
  (t) => ({
    ixClaim: index('claim_attributions_claim_ix').on(t.claimId),
  }),
);

export const clauseEmbeddings = pgTable(
  'clause_embeddings',
  {
    id: idColumn(),
    framework: text('framework').notNull(),
    nodeId: text('node_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    uqFrameworkNode: uniqueIndex('clause_embeddings_framework_node_uq').on(t.framework, t.nodeId),
  }),
);
