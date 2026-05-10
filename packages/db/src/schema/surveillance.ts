// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';

export const surveillanceTelemetry = pgTable(
  'surveillance_telemetry',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    severity: text('severity').notNull().default('info'),
    payload: jsonb('payload').notNull().default({}),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixEngagement: index('surveillance_telemetry_engagement_ix').on(t.engagementId),
  }),
);

export const surveillancePlans = pgTable(
  'surveillance_plans',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    clientId: uuid('client_id').notNull(),
    certificationStartedAt: timestamp('certification_started_at', { withTimezone: true }).notNull(),
    certificationCycleYears: integer('certification_cycle_years').notNull().default(3),
    openNcCarryover: jsonb('open_nc_carryover').notNull().default([]),
    complaintsLog: jsonb('complaints_log').notNull().default([]),
    scopeChanges: jsonb('scope_changes').notNull().default([]),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().default(sql`now()`),
    createdAt: createdAt(),
  },
  (t) => ({
    ixClient: index('surveillance_plans_client_ix').on(t.clientId),
  }),
);

export const surveillanceVisits = pgTable(
  'surveillance_visits',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    planId: uuid('plan_id').notNull(),
    clientId: uuid('client_id').notNull(),
    kind: text('kind').notNull(),
    plannedAt: timestamp('planned_at', { withTimezone: true }).notNull(),
    plannedDurationDays: integer('planned_duration_days').notNull().default(2),
    status: text('status').notNull().default('planned'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    leadAuditorId: uuid('lead_auditor_id'),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => ({
    ixPlan: index('surveillance_visits_plan_ix').on(t.planId),
    ixPlanned: index('surveillance_visits_planned_ix').on(t.firmId, t.plannedAt),
  }),
);

export const surveillanceFlags = pgTable(
  'surveillance_flags',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    planId: uuid('plan_id'),
    clientId: uuid('client_id').notNull(),
    ruleId: text('rule_id').notNull(),
    severity: text('severity').notNull(),
    rationale: text('rationale').notNull(),
    evidence: jsonb('evidence').notNull().default({}),
    suggestedAction: text('suggested_action').notNull(),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().default(sql`now()`),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by'),
  },
  (t) => ({
    ixClient: index('surveillance_flags_client_ix').on(t.firmId, t.clientId, t.raisedAt),
  }),
);

export const webVitalsSamples = pgTable(
  'web_vitals_samples',
  {
    id: idColumn(),
    firmId: uuid('firm_id'),
    auditorId: uuid('auditor_id'),
    name: text('name').notNull(),
    value: doublePrecision('value').notNull(),
    rating: text('rating').notNull(),
    pagePath: text('page_path').notNull(),
    pageUrl: text('page_url').notNull(),
    sessionId: text('session_id'),
    traceId: text('trace_id'),
    spanId: text('span_id'),
    userAgent: text('user_agent'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixPath: index('web_vitals_samples_path_ix').on(t.pagePath, t.occurredAt),
    ixFirm: index('web_vitals_samples_firm_ix').on(t.firmId, t.occurredAt),
  }),
);

export const observabilityErrors = pgTable(
  'observability_errors',
  {
    id: idColumn(),
    firmId: uuid('firm_id'),
    auditorId: uuid('auditor_id'),
    severity: text('severity').notNull().default('error'),
    name: text('name'),
    message: text('message').notNull(),
    stack: text('stack'),
    componentStack: text('component_stack'),
    pagePath: text('page_path').notNull(),
    pageUrl: text('page_url').notNull(),
    sessionId: text('session_id'),
    traceId: text('trace_id'),
    spanId: text('span_id'),
    userAgent: text('user_agent'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixPath: index('observability_errors_path_ix').on(t.pagePath, t.occurredAt),
    ixFirm: index('observability_errors_firm_ix').on(t.firmId, t.occurredAt),
  }),
);
