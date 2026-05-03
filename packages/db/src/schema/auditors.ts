// SPDX-License-Identifier: BUSL-1.1
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { auditFirms } from './firms.js';
import { archivedAt, createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const auditors = pgTable(
  'auditors',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'restrict' }),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    employmentStatus: text('employment_status').notNull().default('employed'),
    primaryRole: text('primary_role').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    bio: text('bio'),
    isActive: boolean('is_active').notNull().default(true),
    webauthnEnabled: boolean('webauthn_enabled').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (t) => ({
    uqEmail: uniqueIndex('auditors_email_uq').on(t.email),
    ixFirm: index('auditors_firm_ix').on(t.firmId),
  }),
);

export const auditorRoles = pgTable(
  'auditor_roles',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => auditors.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    grantedAt: createdAt(),
    revokedAt: archivedAt(),
  },
  (t) => ({
    ixAuditor: index('auditor_roles_auditor_ix').on(t.auditorId),
    uqAuditorRole: uniqueIndex('auditor_roles_auditor_role_uq').on(t.auditorId, t.role),
  }),
);

export const auditorCompetences = pgTable(
  'auditor_competences',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => auditors.id, { onDelete: 'cascade' }),
    competenceType: text('competence_type').notNull(),
    descriptor: text('descriptor').notNull(),
    issuer: text('issuer'),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    cpdHours: integer('cpd_hours'),
    evidenceRef: text('evidence_ref'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixAuditor: index('auditor_competences_auditor_ix').on(t.auditorId),
  }),
);

export const auditorWebauthnCredentials = pgTable(
  'auditor_webauthn_credentials',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => auditors.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key_b64').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: text('transports'),
    label: text('label'),
    lastUsedAt: archivedAt(),
    createdAt: createdAt(),
  },
  (t) => ({
    uqCred: uniqueIndex('auditor_webauthn_credentials_cred_uq').on(t.credentialId),
  }),
);

export const auditorAssignments = pgTable(
  'auditor_assignments',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => auditors.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id').notNull(),
    role: text('role').notNull(),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    impartialityChecked: boolean('impartiality_checked').notNull().default(false),
    conflictNotes: text('conflict_notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixAuditor: index('auditor_assignments_auditor_ix').on(t.auditorId),
    ixEngagement: index('auditor_assignments_engagement_ix').on(t.engagementId),
  }),
);
