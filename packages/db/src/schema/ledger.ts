// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';

export const auditLedgerEvents = pgTable(
  'audit_ledger_events',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    auditorId: uuid('auditor_id'),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    prevHash: text('prev_hash'),
    hash: text('hash').notNull(),
    signature: text('signature'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixFirmSeq: index('audit_ledger_events_firm_seq_ix').on(t.firmId, t.sequence),
  }),
);

export const auditFileArchives = pgTable(
  'audit_file_archives',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    archiveUri: text('archive_uri').notNull(),
    archiveHash: text('archive_hash').notNull(),
    signature: text('signature'),
    metadata: jsonb('metadata').notNull().default({}),
    sealedAt: timestamp('sealed_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixEngagement: index('audit_file_archives_engagement_ix').on(t.engagementId),
  }),
);

export const accreditationGrants = pgTable(
  'accreditation_grants',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    accreditationBody: text('accreditation_body').notNull(),
    grantedTo: text('granted_to').notNull(),
    grantedAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    ixEngagement: index('accreditation_grants_engagement_ix').on(t.engagementId),
  }),
);
