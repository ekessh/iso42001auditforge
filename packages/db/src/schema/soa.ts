// SPDX-License-Identifier: BUSL-1.1
import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const soaRecords = pgTable(
  'soa_records',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    controlId: text('control_id').notNull(),
    applicability: text('applicability').notNull(),
    rationale: text('rationale'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    uqFirmEngagementControl: uniqueIndex('soa_records_firm_engagement_control_uq').on(
      t.firmId,
      t.engagementId,
      t.controlId,
    ),
  }),
);

export const aiRiskRegisterEntries = pgTable(
  'ai_risk_register_entries',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    riskId: text('risk_id').notNull(),
    title: text('title').notNull(),
    likelihood: text('likelihood'),
    impact: text('impact'),
    treatment: text('treatment'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    uqFirmEngagementRisk: uniqueIndex('ai_risk_register_firm_engagement_risk_uq').on(
      t.firmId,
      t.engagementId,
      t.riskId,
    ),
  }),
);
