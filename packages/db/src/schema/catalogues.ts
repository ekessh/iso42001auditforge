// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Reference catalogues — firm-agnostic, populated by seed runner.

export const iso42001Clauses = pgTable('iso42001_clauses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  framework: text('framework').notNull().default('ISO_42001'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const annexAControls = pgTable('annex_a_controls', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const euAiActArticles = pgTable('eu_ai_act_articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  riskTier: text('risk_tier').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const nistAiRmfSubcategories = pgTable('nist_ai_rmf_subcategories', {
  id: text('id').primaryKey(),
  function: text('function').notNull(),
  title: text('title').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const owaspLlmTop10 = pgTable('owasp_llm_top10', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  version: text('version').notNull().default('2025'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const mitreAtlasTechniques = pgTable('mitre_atlas_techniques', {
  id: text('id').primaryKey(),
  tactic: text('tactic').notNull(),
  title: text('title').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const avidCategories = pgTable('avid_categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const avidSubcategories = pgTable('avid_subcategories', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => avidCategories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const mitAiRiskCategories = pgTable('mit_ai_risk_categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const mitAiRiskSubcategories = pgTable('mit_ai_risk_subcategories', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => mitAiRiskCategories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const frameworkMappings = pgTable(
  'framework_mappings',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    fromFramework: text('from_framework').notNull(),
    fromNodeId: text('from_node_id').notNull(),
    toFramework: text('to_framework').notNull(),
    toNodeId: text('to_node_id').notNull(),
    strength: text('strength').notNull(),
    rationale: text('rationale').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    uqEdge: uniqueIndex('framework_mappings_edge_uq').on(
      t.fromFramework,
      t.fromNodeId,
      t.toFramework,
      t.toNodeId,
    ),
  }),
);

export const rbacRoles = pgTable('rbac_roles', {
  role: text('role').primaryKey(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const rbacPermissions = pgTable(
  'rbac_permissions',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    role: text('role')
      .notNull()
      .references(() => rbacRoles.role, { onDelete: 'cascade' }),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    scope: text('scope').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    uqRoleResourceAction: uniqueIndex('rbac_permissions_role_resource_action_uq').on(
      t.role,
      t.resource,
      t.action,
    ),
  }),
);
