// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import { customType, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; default: false }>({
  dataType: () => 'vector(1536)',
});

// Cross-framework retrieval store. Firm-agnostic — every catalogue (ISO
// 42001, Annex A, EU AI Act, NIST AI RMF, OWASP LLM Top 10, MITRE ATLAS,
// AVID, MIT AI Risk, framework mappings) embeds into this single table so
// the search controller can answer queries that span frameworks without a
// UNION ALL across per-framework tables.
export const catalogueEmbeddings = pgTable(
  'catalogue_embeddings',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    framework: text('framework').notNull(),
    nodeId: text('node_id').notNull(),
    embedding: vector('embedding'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    uqFrameworkNode: uniqueIndex('catalogue_embeddings_framework_node_uq').on(t.framework, t.nodeId),
  }),
);
