// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const idColumn = () => uuid('id').primaryKey().default(sql`uuid_generate_v4()`);
const firmIdColumn = () => uuid('firm_id').notNull();
const engagementIdColumn = () => uuid('engagement_id').notNull();
const createdAt = () =>
  timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`);

export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    const dim = config?.dimensions ?? 1536;
    return `vector(${dim})`;
  },
  toDriver(value) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value) {
    if (Array.isArray(value)) return value as number[];
    const s = String(value).replace(/^\[|\]$/g, '');
    if (!s) return [];
    return s.split(',').map((n) => Number(n));
  },
});

export const episodeKindEnum = pgEnum('audit_memory_episode_kind', [
  'interview_turn',
  'auditee_answer',
  'evidence_upload',
  'system_event',
]);

export const speakerRoleEnum = pgEnum('audit_memory_speaker_role', [
  'auditor',
  'auditee',
  'lead_auditor',
  'observer',
  'system',
]);

export const claimValidityEnum = pgEnum('audit_memory_claim_validity', [
  'active',
  'invalidated',
  'superseded',
]);

export const claimRelationKindEnum = pgEnum('audit_memory_claim_relation', [
  'contradicts',
  'supersedes',
  'supports',
]);

export const attributionStatusEnum = pgEnum('audit_memory_attribution_status', [
  'pending',
  'confirmed',
  'rejected',
  'reassigned',
]);

export const schemaVersionStatusEnum = pgEnum('audit_memory_schema_version_status', [
  'draft',
  'frozen',
  'archived',
]);

export const episodes = pgTable(
  'audit_memory_episodes',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    kind: episodeKindEnum('kind').notNull(),
    sourceUtteranceId: uuid('source_utterance_id'),
    speakerRole: speakerRoleEnum('speaker_role'),
    body: text('body').notNull().default(''),
    parentEpisodeId: uuid('parent_episode_id'),
    ingestionTime: timestamp('ingestion_time', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    sourceArchived: boolean('source_archived').notNull().default(false),
  },
  (t) => ({
    ixEngagementIngestion: index('audit_memory_episodes_eng_ingestion_ix').on(
      t.engagementId,
      t.ingestionTime,
    ),
    ixParent: index('audit_memory_episodes_parent_ix').on(t.parentEpisodeId),
  }),
);

export const episodeAttachments = pgTable(
  'audit_memory_episode_attachments',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    episodeId: uuid('episode_id').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sha256: text('sha256').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    storageRef: text('storage_ref').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEpisode: index('audit_memory_episode_attachments_episode_ix').on(t.episodeId),
  }),
);

export const episodeLineage = pgTable(
  'audit_memory_episode_lineage',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    parentEpisodeId: uuid('parent_episode_id').notNull(),
    childEpisodeId: uuid('child_episode_id').notNull(),
    relation: text('relation').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    uqEdge: uniqueIndex('audit_memory_episode_lineage_uq').on(
      t.parentEpisodeId,
      t.childEpisodeId,
      t.relation,
    ),
  }),
);

export const schemaVersions = pgTable(
  'audit_memory_schema_versions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    name: text('name').notNull(),
    status: schemaVersionStatusEnum('status').notNull().default('draft'),
    parentVersionId: uuid('parent_version_id'),
    frozenAt: timestamp('frozen_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    uqEngagementName: uniqueIndex('audit_memory_schema_versions_eng_name_uq').on(
      t.engagementId,
      t.name,
    ),
  }),
);

export const entityTypes = pgTable(
  'audit_memory_entity_types',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    schemaVersionId: uuid('schema_version_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => ({
    uqVersionName: uniqueIndex('audit_memory_entity_types_ver_name_uq').on(
      t.schemaVersionId,
      t.name,
    ),
  }),
);

export const relationTypes = pgTable(
  'audit_memory_relation_types',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    schemaVersionId: uuid('schema_version_id').notNull(),
    name: text('name').notNull(),
    symmetric: boolean('symmetric').notNull().default(false),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => ({
    uqVersionName: uniqueIndex('audit_memory_relation_types_ver_name_uq').on(
      t.schemaVersionId,
      t.name,
    ),
  }),
);

export const claims = pgTable(
  'audit_memory_claims',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    schemaVersionId: uuid('schema_version_id').notNull(),
    entityType: text('entity_type').notNull(),
    subject: text('subject').notNull(),
    predicate: text('predicate').notNull(),
    object: text('object').notNull(),
    extractedByModel: text('extracted_by_model').notNull(),
    modelInvocationId: uuid('model_invocation_id').notNull(),
    eventTimeStart: timestamp('event_time_start', { withTimezone: true }).notNull(),
    eventTimeEnd: timestamp('event_time_end', { withTimezone: true }),
    ingestionTime: timestamp('ingestion_time', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    validity: claimValidityEnum('validity').notNull().default('active'),
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (t) => ({
    ixEventTime: index('audit_memory_claims_event_time_ix').on(
      t.engagementId,
      t.eventTimeStart,
      t.eventTimeEnd,
    ),
    ixSubjectPredicate: index('audit_memory_claims_subj_pred_ix').on(
      t.engagementId,
      t.subject,
      t.predicate,
    ),
    ixIngestion: index('audit_memory_claims_ingestion_ix').on(
      t.engagementId,
      t.ingestionTime,
    ),
    ixObjectTrgm: index('audit_memory_claims_object_trgm_ix')
      .using('gin', sql`${t.object} gin_trgm_ops`),
    ixEmbedding: index('audit_memory_claims_embedding_ix')
      .using('ivfflat', sql`${t.embedding} vector_cosine_ops`),
  }),
);

export const claimTemporal = pgTable(
  'audit_memory_claim_temporal',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    claimId: uuid('claim_id').notNull(),
    validity: claimValidityEnum('validity').notNull(),
    eventTimeStart: timestamp('event_time_start', { withTimezone: true }).notNull(),
    eventTimeEnd: timestamp('event_time_end', { withTimezone: true }),
    reason: text('reason').notNull().default(''),
    actorAuditorId: uuid('actor_auditor_id'),
    recordedAt: createdAt(),
  },
  (t) => ({
    ixClaim: index('audit_memory_claim_temporal_claim_ix').on(t.claimId),
  }),
);

export const claimEvidenceLinks = pgTable(
  'audit_memory_claim_evidence_links',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    claimId: uuid('claim_id').notNull(),
    episodeId: uuid('episode_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    uqLink: uniqueIndex('audit_memory_claim_evidence_uq').on(t.claimId, t.episodeId),
  }),
);

export const claimRelations = pgTable(
  'audit_memory_claim_relations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    claimAId: uuid('claim_a_id').notNull(),
    relation: claimRelationKindEnum('relation').notNull(),
    claimBId: uuid('claim_b_id').notNull(),
    rationale: text('rationale').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => ({
    uqEdge: uniqueIndex('audit_memory_claim_relations_uq').on(
      t.claimAId,
      t.relation,
      t.claimBId,
    ),
    ixB: index('audit_memory_claim_relations_b_ix').on(t.claimBId),
  }),
);

export const claimAttributions = pgTable(
  'audit_memory_claim_attributions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    claimId: uuid('claim_id').notNull(),
    framework: text('framework').notNull(),
    nodeId: text('node_id').notNull(),
    confidence: real('confidence').notNull(),
    rationale: text('rationale').notNull().default(''),
    modelInvocationId: uuid('model_invocation_id').notNull(),
    status: attributionStatusEnum('status').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: uuid('decided_by'),
    createdAt: createdAt(),
  },
  (t) => ({
    ixClaim: index('audit_memory_claim_attributions_claim_ix').on(t.claimId),
    ixFramework: index('audit_memory_claim_attributions_framework_ix').on(
      t.framework,
      t.nodeId,
    ),
  }),
);

export const claimAttributionDecisions = pgTable(
  'audit_memory_claim_attribution_decisions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    attributionId: uuid('attribution_id').notNull(),
    fromStatus: attributionStatusEnum('from_status').notNull(),
    toStatus: attributionStatusEnum('to_status').notNull(),
    actorAuditorId: uuid('actor_auditor_id').notNull(),
    rationale: text('rationale').notNull().default(''),
    decidedAt: createdAt(),
  },
  (t) => ({
    ixAttribution: index('audit_memory_claim_attribution_decisions_attribution_ix').on(
      t.attributionId,
    ),
  }),
);

export const retrievalInvocations = pgTable(
  'audit_memory_retrieval_invocations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    query: text('query').notNull(),
    candidates: jsonb('candidates').notNull(),
    rankedResults: jsonb('ranked_results').notNull(),
    modelInvocationId: uuid('model_invocation_id'),
    atTime: timestamp('at_time', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    ixEngagement: index('audit_memory_retrieval_invocations_eng_ix').on(t.engagementId),
  }),
);

export const extractionInvocations = pgTable(
  'audit_memory_extraction_invocations',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: engagementIdColumn(),
    sourceEpisodeId: uuid('source_episode_id').notNull(),
    modelInvocationId: uuid('model_invocation_id').notNull(),
    schemaVersionId: uuid('schema_version_id').notNull(),
    rawOutput: text('raw_output').notNull(),
    parsedClaimIds: jsonb('parsed_claim_ids').notNull(),
    rejectedReasons: jsonb('rejected_reasons').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    ixSource: index('audit_memory_extraction_invocations_source_ix').on(t.sourceEpisodeId),
  }),
);

export const auditMemoryDimensions = {
  embedding: 1536 as const,
};

export const __indexHelpers = {
  doublePrecision,
  integer,
};
