// SPDX-License-Identifier: BUSL-1.1
import type { AiSystem } from '../types/ai-system.js';
import type { AiSystemKind, AiSystemIntake } from '../types/kinds.js';
import { isAgentKind, isModelKind } from '../types/kinds.js';
import {
  type AiSystemProfile,
  type InferredField,
  type MissingDataFlag,
  type ProbeCategory,
} from '../types/profile.js';

/**
 * Per-kind probe-category seed list. Maps onto the seed probe catalogue in
 * design § 3.5 so the auditor immediately sees which probes are
 * applicable. Curated from OWASP LLM Top 10, MITRE ATLAS, AVID, and the
 * AuditForge probe catalogue.
 */
const KIND_PROBE_CATEGORIES: Readonly<Record<AiSystemKind, readonly ProbeCategory[]>> = {
  predictive_ml: [
    'bias_fairness',
    'robustness_adversarial',
    'drift_detection',
    'explanation_faithfulness',
    'capability_evaluation',
  ],
  generative_llm: [
    'hallucination_rate',
    'prompt_injection',
    'jailbreak_resistance',
    'output_toxicity',
    'output_pii_leakage',
    'refusal_accuracy',
    'data_leakage',
    'capability_evaluation',
  ],
  foundation_model: [
    'capability_evaluation',
    'hallucination_rate',
    'output_toxicity',
    'data_leakage',
    'jailbreak_resistance',
  ],
  edge_model: ['robustness_adversarial', 'drift_detection', 'energy_cost'],
  multimodal: [
    'hallucination_rate',
    'prompt_injection',
    'output_toxicity',
    'output_pii_leakage',
    'capability_evaluation',
  ],
  agent_assistant: [
    'prompt_injection',
    'jailbreak_resistance',
    'human_gate_respect',
    'memory_isolation',
  ],
  tool_using_agent: [
    'tool_permission_drift',
    'prompt_injection',
    'human_gate_respect',
    'memory_isolation',
    'loop_recursion_bound',
  ],
  rag_agent: [
    'prompt_injection',
    'data_leakage',
    'output_pii_leakage',
    'hallucination_rate',
  ],
  browser_agent: [
    'tool_permission_drift',
    'prompt_injection',
    'data_leakage',
    'human_gate_respect',
  ],
  code_agent: [
    'tool_permission_drift',
    'prompt_injection',
    'loop_recursion_bound',
    'human_gate_respect',
  ],
  multi_agent_workflow: [
    'tool_permission_drift',
    'loop_recursion_bound',
    'human_gate_respect',
    'memory_isolation',
  ],
  autonomous_loop: [
    'loop_recursion_bound',
    'tool_permission_drift',
    'human_gate_respect',
    'energy_cost',
  ],
  hitl_workflow: ['human_gate_respect', 'consent_respect'],
  long_horizon_agent: [
    'loop_recursion_bound',
    'memory_isolation',
    'tool_permission_drift',
    'human_gate_respect',
  ],
  cross_system_agent: [
    'tool_permission_drift',
    'data_leakage',
    'memory_isolation',
    'human_gate_respect',
  ],
  training_pipeline: ['drift_detection', 'data_leakage', 'bias_fairness'],
  inference_platform: ['drift_detection', 'energy_cost', 'output_pii_leakage'],
  mcp_server: ['tool_permission_drift', 'data_leakage'],
  vector_db: ['data_leakage', 'output_pii_leakage', 'memory_isolation'],
  prompt_registry: ['prompt_injection'],
  eval_harness: ['capability_evaluation', 'drift_detection'],
  guardrail_system: [
    'prompt_injection',
    'jailbreak_resistance',
    'output_toxicity',
    'output_pii_leakage',
  ],
};

/**
 * Per-kind suggested ISO/IEC 42001 Annex A controls. Curated against
 * Annex A of the published standard (A.2..A.9). Auditors may add or
 * remove controls; this is just a working-paper-template seed.
 */
const KIND_ANNEX_A_CONTROLS: Readonly<Record<AiSystemKind, readonly string[]>> = {
  predictive_ml: ['A.5.4', 'A.6.2.4', 'A.6.2.5', 'A.6.2.6', 'A.7.4', 'A.8.2'],
  generative_llm: ['A.5.4', 'A.6.2.4', 'A.6.2.6', 'A.6.2.7', 'A.7.4', 'A.8.2', 'A.9.3'],
  foundation_model: ['A.5.4', 'A.6.2.4', 'A.6.2.6', 'A.7.2', 'A.7.4'],
  edge_model: ['A.6.2.5', 'A.6.2.8', 'A.8.2'],
  multimodal: ['A.5.4', 'A.6.2.4', 'A.6.2.6', 'A.7.4'],
  agent_assistant: ['A.6.2.5', 'A.6.2.7', 'A.8.3', 'A.9.2'],
  tool_using_agent: ['A.6.2.5', 'A.6.2.7', 'A.8.3', 'A.9.2', 'A.9.3'],
  rag_agent: ['A.6.2.7', 'A.7.2', 'A.7.4', 'A.8.2'],
  browser_agent: ['A.6.2.7', 'A.8.3', 'A.9.2', 'A.9.3'],
  code_agent: ['A.6.2.5', 'A.6.2.7', 'A.8.3', 'A.9.3'],
  multi_agent_workflow: ['A.6.2.5', 'A.6.2.7', 'A.8.3'],
  autonomous_loop: ['A.6.2.5', 'A.6.2.7', 'A.8.3'],
  hitl_workflow: ['A.8.3', 'A.9.2'],
  long_horizon_agent: ['A.6.2.5', 'A.8.3', 'A.9.2'],
  cross_system_agent: ['A.6.2.5', 'A.7.4', 'A.8.3', 'A.9.3'],
  training_pipeline: ['A.6.2.4', 'A.7.2', 'A.7.3', 'A.7.5'],
  inference_platform: ['A.6.2.5', 'A.6.2.8'],
  mcp_server: ['A.6.2.7', 'A.8.3', 'A.9.3'],
  vector_db: ['A.7.4', 'A.7.5'],
  prompt_registry: ['A.6.2.4', 'A.7.5'],
  eval_harness: ['A.6.2.6'],
  guardrail_system: ['A.6.2.6', 'A.6.2.7'],
};

interface KindContext {
  intake: AiSystemIntake;
  kind: AiSystemKind;
}

function pushFlag(out: MissingDataFlag[], field: string, severity: MissingDataFlag['severity'], reason: string): void {
  out.push({ field, severity, reason });
}

/**
 * Derive missing-data flags + inferred fields per kind. The rules are
 * kind-specific because, e.g., `tool_count` is only meaningful for agents
 * and `parameter_count` is only meaningful for LLMs/foundation models.
 */
function analyzeIntake(ctx: KindContext): {
  flags: MissingDataFlag[];
  inferred: InferredField[];
} {
  const flags: MissingDataFlag[] = [];
  const inferred: InferredField[] = [];
  const i = ctx.intake;
  switch (i.kind) {
    case 'generative_llm':
    case 'foundation_model': {
      if (i.parameter_count === undefined) {
        pushFlag(flags, 'parameter_count', 'warn', 'parameter_count needed for EU AI Act GPAI systemic-risk threshold check');
      }
      if (i.training_data_categories === undefined || i.training_data_categories.length === 0) {
        pushFlag(flags, 'training_data_categories', 'block', 'required for Annex A.7 (data) evidence');
      }
      if (i.kind === 'generative_llm' && i.context_window === undefined) {
        pushFlag(flags, 'context_window', 'info', 'context_window informs prompt-injection threat surface');
      }
      if (i.kind === 'foundation_model' && i.systemic_risk_flag === undefined && (i.parameter_count ?? 0) >= 1e11) {
        inferred.push({ field: 'systemic_risk_flag', value: true, confidence: 0.6, source: 'heuristic' });
      }
      break;
    }
    case 'predictive_ml': {
      if (i.protected_attributes_used === undefined) {
        pushFlag(flags, 'protected_attributes_used', 'warn', 'needed for A.5.4 fairness assessment');
      }
      if (i.performance_metrics === undefined) {
        pushFlag(flags, 'performance_metrics', 'warn', 'baseline metrics required for drift / capability probes');
      }
      break;
    }
    case 'edge_model': {
      if (i.ota_update_supported === undefined) {
        pushFlag(flags, 'ota_update_supported', 'info', 'OTA support affects A.6.2.8 monitoring strategy');
      }
      break;
    }
    case 'multimodal':
      // structurally validated by Zod; no extra heuristics beyond those.
      break;
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
      if (i.escalation_paths.length === 0 && i.autonomy_level >= 3) {
        pushFlag(flags, 'escalation_paths', 'block', 'autonomy_level>=3 requires defined escalation paths (A.9.2)');
      }
      if (i.max_loop_iterations === undefined) {
        pushFlag(flags, 'max_loop_iterations', 'warn', 'unbounded loops are a runaway risk per design § 3.6');
      } else if (i.max_loop_iterations > 1000) {
        pushFlag(flags, 'max_loop_iterations', 'warn', 'very high loop cap — verify cost ceiling');
      }
      if (i.persistent_memory_flag) {
        inferred.push({ field: 'memory_isolation_required', value: true, confidence: 0.95, source: 'rule' });
      }
      if (i.kind === 'tool_using_agent' && i.tool_count === 0) {
        pushFlag(flags, 'tool_count', 'warn', 'tool_using_agent declared but tool_count=0; classify as agent_assistant?');
      }
      if (i.kind === 'browser_agent' && i.domains_allowed.length === 0) {
        pushFlag(flags, 'domains_allowed', 'warn', 'browser_agent without allowlist is high-risk per OWASP LLM Top 10');
      }
      if (i.kind === 'code_agent' && (i.sandbox === 'none' || i.sandbox === undefined)) {
        pushFlag(flags, 'sandbox', 'block', 'code_agent must run in a sandbox per A.6.2.7');
      }
      if (i.kind === 'autonomous_loop' && i.budget_caps === undefined) {
        pushFlag(flags, 'budget_caps', 'warn', 'autonomous loops require budget caps');
      }
      break;
    }
    case 'training_pipeline': {
      if (i.experiment_tracking === undefined || i.experiment_tracking === 'none') {
        pushFlag(flags, 'experiment_tracking', 'warn', 'no experiment tracker — A.6.2.4 evidence harder to gather');
      }
      if (i.reproducibility_artifacts.length === 0) {
        pushFlag(flags, 'reproducibility_artifacts', 'block', 'A.6.2.4 reproducibility evidence required');
      }
      break;
    }
    case 'inference_platform': {
      if (i.multitenancy === 'logical' && i.rate_limit_per_tenant !== true) {
        pushFlag(flags, 'rate_limit_per_tenant', 'warn', 'logical multitenancy without per-tenant rate limit');
      }
      break;
    }
    case 'mcp_server': {
      if (i.auth_method === undefined || i.auth_method === 'none') {
        pushFlag(flags, 'auth_method', 'block', 'MCP server must authenticate clients per A.9.3');
      }
      break;
    }
    case 'vector_db': {
      if (i.pii_in_index === true && (i.retention_days === undefined || i.retention_days > 365)) {
        pushFlag(flags, 'retention_days', 'warn', 'PII in index with long retention — review GDPR/A.7.5');
      }
      break;
    }
    case 'prompt_registry': {
      if (!i.approval_workflow) {
        pushFlag(flags, 'approval_workflow', 'warn', 'prompt changes without approval — A.6.2.4 control gap');
      }
      break;
    }
    case 'eval_harness': {
      if (!i.blocking_on_regression) {
        pushFlag(flags, 'blocking_on_regression', 'info', 'non-blocking evals are advisory only');
      }
      break;
    }
    case 'guardrail_system': {
      if (i.fail_mode === 'log_only') {
        pushFlag(flags, 'fail_mode', 'warn', 'guardrails in log_only mode do not enforce policy');
      }
      break;
    }
  }
  return { flags, inferred };
}

/**
 * AiSystemProfiler — turns raw AI-system intake into a structured profile
 * (inferred fields, missing-data flags, suggested probe categories).
 *
 * Mappings:
 *  - design § 3.3 (AI System Profiler)
 *  - design § 3.5 (Probe Library) — drives probe-category recommendations
 *  - ISO/IEC 42001 Annex A — drives suggested working-paper templates
 */
export class AiSystemProfiler {
  /**
   * Generate a profile for an AiSystem record.
   *
   * @param system Validated AiSystem record (use the registry to obtain).
   * @returns A {@link AiSystemProfile} the UI / probe runner consumes.
   */
  profile(system: AiSystem, generatedAt: string = new Date().toISOString()): AiSystemProfile {
    const { flags, inferred } = analyzeIntake({ intake: system.intake, kind: system.kind });
    const probeCategories = [...(KIND_PROBE_CATEGORIES[system.kind] ?? [])];
    const annexA = [...(KIND_ANNEX_A_CONTROLS[system.kind] ?? [])];

    // Cross-kind heuristics: agent + multimodal => add output_toxicity & pii.
    if (isAgentKind(system.kind) && !probeCategories.includes('output_toxicity')) {
      // most agents go through an LLM, so toxicity is implicitly relevant.
      probeCategories.push('output_toxicity');
    }
    if (isModelKind(system.kind) && system.deploymentContext === 'edge_device') {
      if (!probeCategories.includes('energy_cost')) probeCategories.push('energy_cost');
    }

    // Completeness score — naive but useful UX hint.
    const blockingFlags = flags.filter((f) => f.severity === 'block').length;
    const warningFlags = flags.filter((f) => f.severity === 'warn').length;
    const completenessScore = Math.max(
      0,
      Math.min(100, 100 - blockingFlags * 25 - warningFlags * 5),
    );

    return {
      aiSystemId: system.id,
      generatedAt,
      inferredFields: inferred,
      missingDataFlags: flags,
      suggestedProbeCategories: probeCategories,
      suggestedAnnexAControls: annexA,
      completenessScore,
    };
  }
}

/** Exported for tests / external introspection. */
export const KIND_PROBE_CATEGORY_MAP = KIND_PROBE_CATEGORIES;
export const KIND_ANNEX_A_CONTROL_MAP = KIND_ANNEX_A_CONTROLS;
