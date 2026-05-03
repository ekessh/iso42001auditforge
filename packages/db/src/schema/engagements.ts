// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { archivedAt, createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';
import { auditFirms } from './firms.js';

export const clients = pgTable(
  'clients',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(),
    countryCode: text('country_code').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (t) => ({
    ixFirm: index('clients_firm_ix').on(t.firmId),
  }),
);

export const engagements = pgTable(
  'engagements',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    clientId: uuid('client_id').notNull(),
    code: text('code').notNull(),
    mode: text('mode').notNull().default('audit'),
    stage: text('stage').notNull().default('stage1'),
    status: text('status').notNull().default('draft'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (t) => ({
    uqFirmCode: uniqueIndex('engagements_firm_code_uq').on(t.firmId, t.code),
    ixFirm: index('engagements_firm_ix').on(t.firmId),
  }),
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixEngagement: index('audit_events_engagement_ix').on(t.engagementId),
  }),
);

export const auditPlans = pgTable(
  'audit_plans',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    name: text('name').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixEngagement: index('audit_plans_engagement_ix').on(t.engagementId),
  }),
);

export const planSessions = pgTable(
  'plan_sessions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => auditPlans.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixPlan: index('plan_sessions_plan_ix').on(t.planId),
  }),
);

export const auditTeams = pgTable(
  'audit_teams',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    name: text('name').notNull(),
    members: jsonb('members').notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('audit_teams_engagement_ix').on(t.engagementId),
  }),
);
