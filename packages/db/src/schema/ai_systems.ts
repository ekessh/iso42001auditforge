// SPDX-License-Identifier: BUSL-1.1
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const aiSystems = pgTable(
  'ai_systems',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    name: text('name').notNull(),
    systemType: text('system_type').notNull(),
    riskTier: text('risk_tier'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixFirm: index('ai_systems_firm_ix').on(t.firmId),
  }),
);

export const aiSystemVersions = pgTable(
  'ai_system_versions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    aiSystemId: uuid('ai_system_id')
      .notNull()
      .references(() => aiSystems.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    modelHash: text('model_hash'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    uqVersion: uniqueIndex('ai_system_versions_system_version_uq').on(t.aiSystemId, t.version),
  }),
);

export const agentWorkflows = pgTable(
  'agent_workflows',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    aiSystemId: uuid('ai_system_id').references(() => aiSystems.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    autonomyLevel: text('autonomy_level').notNull().default('l1_suggest'),
    spec: jsonb('spec').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixFirm: index('agent_workflows_firm_ix').on(t.firmId),
  }),
);

export const agentTools = pgTable(
  'agent_tools',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => agentWorkflows.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    spec: jsonb('spec').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixWorkflow: index('agent_tools_workflow_ix').on(t.workflowId),
  }),
);
