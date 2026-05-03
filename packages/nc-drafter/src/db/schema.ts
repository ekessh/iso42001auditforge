// SPDX-License-Identifier: BUSL-1.1
/**
 * Drizzle schema slice for the Parallel NC Drafter.
 *
 * Per v3 §17.2 the engine adds three tables:
 *   - candidate_findings
 *   - candidate_finding_evidence
 *   - candidate_finding_decisions
 *
 * RLS is intentionally not embedded here — tenancy enforcement lives in the
 * `infra/sql/rls/` layer and replicates across the app guard. We expose the
 * column shape only.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const candidateFindings = pgTable(
  'candidate_findings',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    firmId: uuid('firm_id').notNull(),
    engagementId: uuid('engagement_id').notNull(),
    type: varchar('type', { length: 16 }).notNull(),
    draftStatement: text('draft_statement').notNull(),
    linkedClauses: jsonb('linked_clauses').notNull().default([]),
    linkedControls: jsonb('linked_controls').notNull().default([]),
    sourceClaimIds: jsonb('source_claim_ids').notNull().default([]),
    sourceEpisodeIds: jsonb('source_episode_ids').notNull().default([]),
    confidence: doublePrecision('confidence').notNull(),
    suggestedRootCausePrompts: jsonb('suggested_root_cause_prompts')
      .notNull()
      .default([]),
    proposedSeverityRationale: text('proposed_severity_rationale').notNull(),
    modelInvocationId: varchar('model_invocation_id', { length: 128 }),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    dismissalReason: jsonb('dismissal_reason'),
    detectorId: varchar('detector_id', { length: 128 }).notNull(),
    promptTemplateVersion: varchar('prompt_template_version', { length: 64 })
      .notNull(),
    auditeeVisible: boolean('auditee_visible').notNull().default(false),
  },
  (t) => ({
    byEngagement: index('candidate_findings_engagement_idx').on(t.engagementId),
    byStatus: index('candidate_findings_status_idx').on(t.status),
    byFirm: index('candidate_findings_firm_idx').on(t.firmId),
  }),
);

export const candidateFindingEvidence = pgTable(
  'candidate_finding_evidence',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    candidateFindingId: uuid('candidate_finding_id').notNull(),
    claimId: varchar('claim_id', { length: 128 }).notNull(),
    episodeId: varchar('episode_id', { length: 128 }).notNull(),
    weight: doublePrecision('weight').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byCandidate: index('cf_evidence_candidate_idx').on(t.candidateFindingId),
  }),
);

export const candidateFindingDecisions = pgTable(
  'candidate_finding_decisions',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    candidateFindingId: uuid('candidate_finding_id').notNull(),
    action: varchar('action', { length: 16 }).notNull(),
    actor: uuid('actor').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().default(sql`now()`),
    dismissalReason: jsonb('dismissal_reason'),
    promotedFindingId: uuid('promoted_finding_id'),
    notes: text('notes'),
  },
  (t) => ({
    byCandidate: index('cf_decisions_candidate_idx').on(t.candidateFindingId),
    byAction: index('cf_decisions_action_idx').on(t.action),
  }),
);

export const ncDrafterSchema = {
  candidateFindings,
  candidateFindingEvidence,
  candidateFindingDecisions,
} as const;
