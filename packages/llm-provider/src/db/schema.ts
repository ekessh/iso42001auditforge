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
    promptTemplateVersion: text('prompt_template_version').notNull(),
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
