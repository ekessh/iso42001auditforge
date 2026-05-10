// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';

export const auditLedgerEvents = pgTable(
  'audit_ledger_events',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    auditorId: uuid('auditor_id'),
    eventType: text('event_type').notNull(),
    schemaVersion: smallint('schema_version').notNull().default(1),
    producer: text('producer'),
    payload: jsonb('payload').notNull().default({}),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    prevHash: text('prev_hash'),
    hash: text('hash').notNull(),
    chainHash: text('chain_hash').notNull(),
    signature: text('signature'),
    signerKeyId: text('signer_key_id'),
    publicKey: text('public_key'),
    tsaToken: jsonb('tsa_token'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    ixFirmSeq: index('audit_ledger_events_firm_seq_ix').on(t.firmId, t.sequence),
  }),
);

export const ledgerOutbox = pgTable(
  'ledger_outbox',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    auditorId: uuid('auditor_id'),
    producer: text('producer').notNull(),
    eventType: text('event_type').notNull(),
    schemaVersion: smallint('schema_version').notNull().default(1),
    payload: jsonb('payload').notNull().default({}),
    applyTsa: boolean('apply_tsa').notNull().default(false),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().default(sql`now()`),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ledgerEventId: uuid('ledger_event_id'),
  },
  (t) => ({
    ixFirmStatus: index('ledger_outbox_firm_status_ix').on(t.firmId, t.status, t.enqueuedAt),
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
