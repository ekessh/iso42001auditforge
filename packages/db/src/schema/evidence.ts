// SPDX-License-Identifier: BUSL-1.1
import { bigint, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { archivedAt, createdAt, firmIdColumn, idColumn } from './_shared.js';

export const evidenceObjects = pgTable(
  'evidence_objects',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    blake3: text('blake3'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    mimeType: text('mime_type'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
    archivedAt: archivedAt(),
  },
  (t) => ({
    uqStorage: uniqueIndex('evidence_objects_firm_storage_uq').on(t.firmId, t.storageKey),
    ixEngagement: index('evidence_objects_engagement_ix').on(t.engagementId),
  }),
);

export const evidenceLinks = pgTable(
  'evidence_links',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidenceObjects.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    ixTarget: index('evidence_links_target_ix').on(t.targetType, t.targetId),
  }),
);
