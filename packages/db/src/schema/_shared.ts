// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  pgEnum,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const idColumn = () =>
  uuid('id').primaryKey().default(sql`uuid_generate_v4()`);

export const firmIdColumn = () => uuid('firm_id').notNull();

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`);

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`);

export const archivedAt = () =>
  timestamp('archived_at', { withTimezone: true });

export const sha256Hex = (name = 'sha256') => text(name);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'stage1',
  'stage2',
  'surveillance',
  'recertification',
  'special',
]);

export const engagementStatusEnum = pgEnum('engagement_status', [
  'draft',
  'planning',
  'active',
  'on_hold',
  'closed',
  'cancelled',
]);

export const verdictEnum = pgEnum('working_paper_verdict', [
  'conformant',
  'minor_nc',
  'major_nc',
  'ofi',
  'na',
]);

export const findingTypeEnum = pgEnum('finding_type', [
  'major_nc',
  'minor_nc',
  'ofi',
  'conformity',
]);

export const findingStateEnum = pgEnum('finding_state', [
  'draft',
  'open',
  'capa_proposed',
  'capa_accepted',
  'capa_implemented',
  'capa_verified',
  'closed',
  'rejected',
]);

export const probeModeEnum = pgEnum('probe_mode', ['offline', 'live', 'replay']);
export const probeVerdictEnum = pgEnum('probe_verdict', ['pass', 'fail', 'inconclusive']);

export const aiSystemTypeEnum = pgEnum('ai_system_type', [
  'predictive_ml',
  'generative_llm',
  'foundation_model',
  'multi_modal',
  'edge_embedded',
  'agent',
  'agentic_workflow',
  'pipeline',
]);

export const euAiActRiskTierEnum = pgEnum('eu_ai_act_risk_tier', [
  'prohibited',
  'high',
  'limited',
  'minimal',
  'general-purpose',
  'general',
]);

export const autonomyLevelEnum = pgEnum('autonomy_level', [
  'l1_suggest',
  'l2_execute_with_approval',
  'l3_execute_with_audit',
  'l4_execute_autonomous',
]);

export const samplingMethodEnum = pgEnum('sampling_method', [
  'random',
  'judgmental',
  'stratified',
  'systematic',
]);

export const interviewStatusEnum = pgEnum('interview_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const traceSourceEnum = pgEnum('trace_source', [
  'otel',
  'langfuse',
  'phoenix',
  'arize',
  'custom',
]);

export const reportTypeEnum = pgEnum('report_type', [
  'stage1',
  'stage2',
  'surveillance',
  'recertification',
  'findings_summary',
  'technical_annex',
  'cross_framework_annex',
]);

export const reportStateEnum = pgEnum('report_state', [
  'draft',
  'in_review',
  'signed',
  'issued',
  'superseded',
]);

export const peerReviewVerdictEnum = pgEnum('peer_review_verdict', [
  'pending',
  'approved',
  'rejected',
  'changes_requested',
]);

export const coAuditorBackendEnum = pgEnum('co_auditor_backend', ['local', 'cloud']);

export const mappingStrengthEnum = pgEnum('mapping_strength', [
  'equivalent',
  'subsumes',
  'supports',
  'partial',
  'referenced_by',
]);

export const frameworkIdEnum = pgEnum('framework_id', [
  'ISO_42001',
  'ANNEX_A',
  'EU_AI_ACT',
  'NIST_AI_RMF',
  'OWASP_LLM_TOP10',
  'MITRE_ATLAS',
  'AVID',
  'MIT_AI_RISK',
]);

export const surveillanceAlertSeverityEnum = pgEnum('surveillance_alert_severity', [
  'info',
  'warning',
  'critical',
]);

export const probeExecutionStatusEnum = pgEnum('probe_execution_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
