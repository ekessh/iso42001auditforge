// SPDX-License-Identifier: BUSL-1.1
import { AiSystemCreateInputSchema, type AiSystemCreateInput } from '../types/ai-system.js';
import { AiSystemKindSchema } from '../types/kinds.js';
import type { ValidationIssue } from '../types/validation.js';

/**
 * Take a loosely-typed row (e.g., XLSX cell map, JSON object) and return a
 * `Result`-shaped tuple (`AiSystemCreateInput | undefined`, issues[]).
 *
 * The function is permissive on absent intake fields (sets safe defaults)
 * but strict on `kind` because that drives the discriminated union.
 */
export function normalizeRow(
  row: Record<string, unknown>,
  rowIndex: number,
): { record: AiSystemCreateInput | undefined; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const kindRaw = (row.kind ?? row.system_kind ?? row.type) as string | undefined;
  const kindParsed = AiSystemKindSchema.safeParse(kindRaw);
  if (!kindParsed.success) {
    issues.push({
      level: 'error',
      code: 'IMPORTER_BAD_KIND',
      message: `unknown or missing 'kind' (got: ${String(kindRaw)})`,
      path: ['kind'],
      row: rowIndex,
    });
    return { record: undefined, issues };
  }
  const intake = buildIntake(kindParsed.data, row);
  const candidate = {
    clientId: row.clientId ?? row.client_id,
    engagementId: row.engagementId ?? row.engagement_id,
    name: row.name ?? row.system_name ?? row.label,
    description: row.description ?? row.summary,
    kind: kindParsed.data,
    intake,
    lifecycleStage: row.lifecycleStage ?? row.lifecycle_stage ?? 'operation',
    deploymentContext: row.deploymentContext ?? row.deployment_context ?? 'cloud_saas',
    useCaseDescription: row.useCaseDescription ?? row.use_case ?? row.purpose ?? row.description,
    externalRef: row.externalRef ?? row.external_ref ?? row.id ?? row.run_id,
    sourceImporter: row.sourceImporter ?? row.source ?? 'manual',
  };
  const parsed = AiSystemCreateInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        level: 'error',
        code: `ZOD_${issue.code}`.toUpperCase(),
        message: issue.message,
        path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
        row: rowIndex,
      });
    }
    return { record: undefined, issues };
  }
  return { record: parsed.data, issues };
}

function asIntList(v: unknown): string[] | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    return v
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return undefined;
}

function asBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const l = v.toLowerCase().trim();
    if (['true', 'yes', 'y', '1'].includes(l)) return true;
    if (['false', 'no', 'n', '0'].includes(l)) return false;
  }
  return undefined;
}

function asNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build a kind-specific intake payload from a flat row by selecting only
 * the fields meaningful for that kind. Missing optional fields are
 * dropped; the registry/profiler will surface them as missing-data flags.
 */
function buildIntake(kind: string, row: Record<string, unknown>): unknown {
  const base: Record<string, unknown> = { kind };
  switch (kind) {
    case 'predictive_ml':
      return drop({
        kind,
        task_type: row.task_type ?? row.taskType,
        algorithm_family: row.algorithm_family ?? row.algorithmFamily,
        feature_count: asNum(row.feature_count ?? row.featureCount),
        training_data_categories: asIntList(row.training_data_categories ?? row.trainingDataCategories),
        protected_attributes_used: asIntList(row.protected_attributes_used),
      });
    case 'generative_llm':
      return drop({
        kind,
        model_family: row.model_family ?? row.modelFamily,
        parameter_count: asNum(row.parameter_count ?? row.parameterCount),
        context_window: asNum(row.context_window ?? row.contextWindow),
        training_data_categories: asIntList(row.training_data_categories),
        fine_tuned_from: row.fine_tuned_from ?? row.fineTunedFrom,
        rlhf_applied: asBool(row.rlhf_applied ?? row.rlhfApplied),
        output_modalities: asIntList(row.output_modalities),
      });
    case 'foundation_model':
      return drop({
        kind,
        model_family: row.model_family ?? row.modelFamily,
        parameter_count: asNum(row.parameter_count ?? row.parameterCount),
        training_compute_flops: asNum(row.training_compute_flops),
        systemic_risk_flag: asBool(row.systemic_risk_flag),
        training_data_categories: asIntList(row.training_data_categories),
      });
    case 'edge_model':
      return drop({
        kind,
        hardware_target: row.hardware_target ?? row.hardwareTarget,
        quantization: row.quantization,
        ota_update_supported: asBool(row.ota_update_supported),
        offline_capable: asBool(row.offline_capable),
      });
    case 'multimodal':
      return drop({
        kind,
        input_modalities: asIntList(row.input_modalities),
        output_modalities: asIntList(row.output_modalities),
        model_family: row.model_family,
      });
    case 'agent_assistant':
    case 'tool_using_agent':
    case 'rag_agent':
    case 'browser_agent':
    case 'code_agent':
    case 'multi_agent_workflow':
    case 'autonomous_loop':
    case 'hitl_workflow':
    case 'long_horizon_agent':
    case 'cross_system_agent': {
      Object.assign(base, {
        tool_count: asNum(row.tool_count ?? row.toolCount) ?? 0,
        autonomy_level: asNum(row.autonomy_level ?? row.autonomyLevel) ?? 1,
        persistent_memory_flag: asBool(row.persistent_memory_flag ?? row.persistentMemoryFlag) ?? false,
        escalation_paths: asIntList(row.escalation_paths) ?? [],
        underlying_llm: row.underlying_llm ?? row.underlyingLlm,
        max_loop_iterations: asNum(row.max_loop_iterations),
      });
      if (kind === 'tool_using_agent') {
        base.tool_categories = asIntList(row.tool_categories) ?? ['read'];
      }
      if (kind === 'rag_agent') {
        base.retrieval_sources = asIntList(row.retrieval_sources) ?? [];
        base.retrieval_freshness = row.retrieval_freshness;
      }
      if (kind === 'browser_agent') {
        base.domains_allowed = asIntList(row.domains_allowed) ?? [];
        base.domains_denied = asIntList(row.domains_denied) ?? [];
        base.credentials_handling = row.credentials_handling;
      }
      if (kind === 'code_agent') {
        base.sandbox = row.sandbox;
        base.network_egress = row.network_egress;
      }
      if (kind === 'multi_agent_workflow') {
        base.orchestration_pattern = row.orchestration_pattern;
        base.agent_count = asNum(row.agent_count) ?? 1;
      }
      if (kind === 'autonomous_loop') {
        base.termination_criteria = asIntList(row.termination_criteria) ?? ['max_steps'];
        if (asNum(row.max_tokens) !== undefined || asNum(row.max_usd) !== undefined) {
          base.budget_caps = drop({
            max_tokens: asNum(row.max_tokens),
            max_usd: asNum(row.max_usd),
          });
        }
      }
      if (kind === 'hitl_workflow') {
        base.human_gate_count = asNum(row.human_gate_count) ?? 0;
        base.gate_sla_seconds = asNum(row.gate_sla_seconds);
      }
      if (kind === 'long_horizon_agent') {
        base.planning_horizon_steps = asNum(row.planning_horizon_steps) ?? 1;
        base.checkpointing = asBool(row.checkpointing);
      }
      if (kind === 'cross_system_agent') {
        base.external_systems = asIntList(row.external_systems) ?? ['unknown'];
        base.trust_boundaries = asIntList(row.trust_boundaries) ?? [];
      }
      return drop(base);
    }
    case 'training_pipeline':
      return drop({
        kind,
        framework: row.framework,
        experiment_tracking: row.experiment_tracking,
        reproducibility_artifacts: asIntList(row.reproducibility_artifacts) ?? [],
        data_lineage_tracked: asBool(row.data_lineage_tracked),
      });
    case 'inference_platform':
      return drop({
        kind,
        serving_framework: row.serving_framework,
        hosted_models_count: asNum(row.hosted_models_count) ?? 0,
        multitenancy: row.multitenancy,
        rate_limit_per_tenant: asBool(row.rate_limit_per_tenant),
      });
    case 'mcp_server':
      return drop({
        kind,
        exposed_tools: asIntList(row.exposed_tools) ?? [],
        exposed_resources: asIntList(row.exposed_resources) ?? [],
        auth_method: row.auth_method,
      });
    case 'vector_db':
      return drop({
        kind,
        engine: row.engine,
        embedding_models: asIntList(row.embedding_models) ?? [],
        pii_in_index: asBool(row.pii_in_index),
        retention_days: asNum(row.retention_days),
      });
    case 'prompt_registry':
      return drop({
        kind,
        versioning_scheme: row.versioning_scheme ?? 'hash',
        approval_workflow: asBool(row.approval_workflow),
        prompt_count: asNum(row.prompt_count),
      });
    case 'eval_harness':
      return drop({
        kind,
        eval_suites: asIntList(row.eval_suites) ?? [],
        scheduled: asBool(row.scheduled),
        blocking_on_regression: asBool(row.blocking_on_regression),
      });
    case 'guardrail_system':
      return drop({
        kind,
        guardrail_categories: asIntList(row.guardrail_categories) ?? ['toxicity'],
        fail_mode: row.fail_mode ?? 'log_only',
      });
  }
  return base;
}

function drop<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) {
    if (o[k] === undefined) delete o[k];
  }
  return o;
}
