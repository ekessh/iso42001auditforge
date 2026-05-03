// SPDX-License-Identifier: BUSL-1.1
import { boolean, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { archivedAt, createdAt, idColumn, updatedAt } from './_shared.js';

export const auditFirms = pgTable(
  'audit_firms',
  {
    id: idColumn(),
    name: text('name').notNull(),
    legalName: text('legal_name').notNull(),
    countryCode: text('country_code').notNull(),
    isSolo: boolean('is_solo').notNull().default(false),
    accreditationBody: text('accreditation_body'),
    accreditationNumber: text('accreditation_number'),
    contactEmail: text('contact_email'),
    settings: text('settings_json').default('{}'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (t) => ({
    uqLegalName: uniqueIndex('audit_firms_legal_name_uq').on(t.legalName),
  }),
);
