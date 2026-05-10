// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const idColumn = () => uuid('id').primaryKey().default(sql`uuid_generate_v4()`);
const firmIdColumn = () => uuid('firm_id').notNull();
const engagementIdColumn = () => uuid('engagement_id').notNull();
const createdAt = () =>
  timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`);

export const llmDecisionEnum = pgEnum('llm_invocation_decision', [
  'accepted',
  'rejected',
]);

export const llmTierEnum = pgEnum('llm_invocation_tier', [
  'small',
  'medium',
  'large',
  'reasoning',
]);

export const llmInvocations = pgTable(
  'llm_invocations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    task: text('task').notNull(),
    tier: llmTierEnum('tier').notNull(),
    provider: text('provider').notNull(),
    modelName: text('model_name').notNull(),
    modelHash: text('model_hash'),
    modelVersion: text('model_version'),
    temperature: real('temperature'),
    promptTemplateId: text('prompt_template_id'),
    promptTemplateVersion: text('prompt_template_version').notNull(),
    promptTemplateHash: text('prompt_template_hash'),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    costUsd: real('cost_usd'),
    reasoningTrace: text('reasoning_trace'),
    decision: llmDecisionEnum('decision'),
    decisionByAuditorId: uuid('decision_by_auditor_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('llm_invocations_engagement_ix').on(t.engagementId),
    ixTask: index('llm_invocations_task_ix').on(t.engagementId, t.task),
    ixCreated: index('llm_invocations_created_ix').on(t.engagementId, t.createdAt),
    ixProvider: index('llm_invocations_provider_ix').on(t.provider, t.modelName),
  }),
);

export const consentRecords = pgTable(
  'consent_records',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    grantedBy: uuid('granted_by').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    providers: text('providers').array().notNull(),
    purpose: text('purpose').notNull(),
    scope: jsonb('scope').notNull().default({}),
    writtenConsentDocId: text('written_consent_doc_id'),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('consent_records_engagement_ix').on(t.engagementId),
  }),
);

export const claimSchemaRegistry = pgTable(
  'claim_schema_registry',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    version: integer('version').notNull(),
    entityTypes: jsonb('entity_types').notNull().default([]),
    relationTypes: jsonb('relation_types').notNull().default([]),
    status: text('status').notNull().default('draft'),
    parentVersionId: uuid('parent_version_id'),
    frozenAt: timestamp('frozen_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('claim_schema_registry_engagement_ix').on(t.engagementId),
  }),
);

export const llmBudgetEvents = pgTable(
  'llm_budget_events',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    event: text('event').notNull(),
    capUsd: real('cap_usd'),
    spentUsd: real('spent_usd').notNull(),
    projectedUsd: real('projected_usd').notNull(),
    utilization: real('utilization').notNull(),
    raisedAt: timestamp('raised_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    ixEngagement: index('llm_budget_events_engagement_ix').on(t.engagementId, t.raisedAt),
  }),
);
