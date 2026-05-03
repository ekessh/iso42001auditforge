// SPDX-License-Identifier: BUSL-1.1
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Question library table — current canonical row per library question.
 * Source of truth is src/question-library/library.json; this table is the
 * runtime materialisation seeded by the loader.
 */
export const questionLibrary = pgTable(
  'question_library',
  {
    id: text('id').primaryKey(),
    version: integer('version').notNull(),
    text: text('text').notNull(),
    intent: text('intent').notNull(),
    mappedClauses: jsonb('mapped_clauses').$type<readonly string[]>().notNull(),
    applicableKinds: jsonb('applicable_kinds').$type<readonly string[]>().notNull(),
    applicablePhases: jsonb('applicable_phases').$type<readonly string[]>().notNull(),
    expectedEvidenceTypes: jsonb('expected_evidence_types')
      .$type<readonly string[]>()
      .notNull(),
    commonDeflections: jsonb('common_deflections').$type<readonly string[]>().notNull(),
    tags: jsonb('tags').$type<readonly string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    versionIdx: index('ql_version_idx').on(t.id, t.version),
  }),
);

/**
 * Versioned snapshots of every library entry. Append-only.
 */
export const questionLibraryVersions = pgTable(
  'question_library_versions',
  {
    id: text('id').notNull(),
    version: integer('version').notNull(),
    text: text('text').notNull(),
    intent: text('intent').notNull(),
    payload: jsonb('payload').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    publishedBy: uuid('published_by'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.version] }),
  }),
);

export const questionFollowups = pgTable(
  'question_followups',
  {
    id: text('id').primaryKey(),
    parentQuestionId: text('parent_question_id').notNull(),
    triggerKind: text('trigger_kind').notNull(),
    triggerPattern: text('trigger_pattern'),
    triggerQuestionId: text('trigger_question_id'),
    targetQuestionId: text('target_question_id'),
    text: text('text'),
    mappedClauses: jsonb('mapped_clauses').$type<readonly string[]>().notNull(),
    expectedEvidenceTypes: jsonb('expected_evidence_types')
      .$type<readonly string[]>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index('qf_parent_idx').on(t.parentQuestionId),
  }),
);

/**
 * Every question generated for an engagement, with full provenance:
 * source library entry, version, contextualisation source, model invocation
 * (when present), rationale.
 */
export const questionInvocations = pgTable(
  'question_invocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id').notNull(),
    firmId: uuid('firm_id').notNull(),
    sourceLibraryId: text('source_library_id').notNull(),
    libraryVersion: integer('library_version').notNull(),
    textShown: text('text_shown').notNull(),
    contextualizedFromLibraryId: text('contextualized_from_library_id'),
    modelInvocationId: text('model_invocation_id'),
    rationale: jsonb('rationale').$type<readonly string[]>().notNull(),
    mappedClauses: jsonb('mapped_clauses').$type<readonly string[]>().notNull(),
    expectedEvidenceTypes: jsonb('expected_evidence_types')
      .$type<readonly string[]>()
      .notNull(),
    askedAt: timestamp('asked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    engIdx: index('qi_eng_idx').on(t.engagementId),
    libIdx: index('qi_lib_idx').on(t.sourceLibraryId, t.libraryVersion),
  }),
);

/**
 * Auditor accept / edit / reject decision per generated question.
 */
export const questionDecisions = pgTable(
  'question_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionInvocationId: uuid('question_invocation_id').notNull(),
    auditorId: uuid('auditor_id').notNull(),
    decision: text('decision').notNull(),
    editedText: text('edited_text'),
    note: text('note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invIdx: index('qd_inv_idx').on(t.questionInvocationId),
    decIdx: index('qd_decision_idx').on(t.decision),
  }),
);

/**
 * Coverage state per (engagement, clause). One row per clause.
 */
export const coverageState = pgTable(
  'coverage_state',
  {
    firmId: uuid('firm_id').notNull(),
    engagementId: uuid('engagement_id').notNull(),
    clauseId: text('clause_id').notNull(),
    status: text('status').notNull(),
    confidence: real('confidence').notNull().default(0),
    lastUpdate: timestamp('last_update', { withTimezone: true }).notNull().defaultNow(),
    lastClaimIds: jsonb('last_claim_ids').$type<readonly string[]>().notNull(),
    naReason: text('na_reason'),
    naConfirmed: boolean('na_confirmed').default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.engagementId, t.clauseId] }),
    statusIdx: index('cs_status_idx').on(t.engagementId, t.status),
    firmIdx: uniqueIndex('cs_firm_eng_clause_uq').on(
      t.firmId,
      t.engagementId,
      t.clauseId,
    ),
  }),
);

/**
 * Bi-temporal history of every coverage transition. Append-only.
 */
export const coverageStateHistory = pgTable(
  'coverage_state_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    engagementId: uuid('engagement_id').notNull(),
    clauseId: text('clause_id').notNull(),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    eventTime: timestamp('event_time', { withTimezone: true }).notNull(),
    ingestionTime: timestamp('ingestion_time', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text('reason').notNull(),
    claimId: text('claim_id'),
  },
  (t) => ({
    engClauseIdx: index('csh_eng_clause_idx').on(t.engagementId, t.clauseId),
    eventTimeIdx: index('csh_event_time_idx').on(t.eventTime),
  }),
);
