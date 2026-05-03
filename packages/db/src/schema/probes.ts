// SPDX-License-Identifier: BUSL-1.1
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const probeDefinitions = pgTable(
  'probe_definitions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    name: text('name').notNull(),
    mode: text('mode').notNull().default('offline'),
    spec: jsonb('spec').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixFirm: index('probe_definitions_firm_ix').on(t.firmId),
  }),
);

export const probeExecutions = pgTable(
  'probe_executions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    probeDefinitionId: uuid('probe_definition_id')
      .notNull()
      .references(() => probeDefinitions.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('queued'),
    verdict: text('verdict'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    output: jsonb('output').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('probe_executions_engagement_ix').on(t.engagementId),
  }),
);

export const agentTraces = pgTable(
  'agent_traces',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    source: text('source').notNull().default('otel'),
    spans: jsonb('spans').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    ixEngagement: index('agent_traces_engagement_ix').on(t.engagementId),
  }),
);

export const coAuditorInvocations = pgTable(
  'co_auditor_invocations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    auditorId: uuid('auditor_id'),
    backend: text('backend').notNull().default('local'),
    request: jsonb('request').notNull().default({}),
    response: jsonb('response').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    ixEngagement: index('co_auditor_invocations_engagement_ix').on(t.engagementId),
  }),
);

export const llmInvocations = pgTable(
  'llm_invocations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    provider: text('provider').notNull(),
    modelName: text('model_name').notNull(),
    modelHash: text('model_hash'),
    promptTemplateId: text('prompt_template_id'),
    decision: text('decision'),
    reasoningTrace: jsonb('reasoning_trace').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixFirm: index('llm_invocations_firm_ix').on(t.firmId),
  }),
);
