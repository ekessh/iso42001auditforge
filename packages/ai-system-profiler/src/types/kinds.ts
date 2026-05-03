// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { AutonomyLevelSchema } from './lifecycle.js';

/**
 * AI System kinds — exhaustive taxonomy used to drive type-specific intake
 * forms (design § 3.3) and probe-category recommendations (§ 3.5).
 *
 * Keep ordered: pure model -> agentic -> infra/platform.
 */
export const AiSystemKindSchema = z.enum([
  'predictive_ml',
  'generative_llm',
  'foundation_model',
  'edge_model',
  'multimodal',
  'agent_assistant',
  'tool_using_agent',
  'rag_agent',
  'browser_agent',
  'code_agent',
  'multi_agent_workflow',
  'autonomous_loop',
  'hitl_workflow',
  'long_horizon_agent',
  'cross_system_agent',
  'training_pipeline',
  'inference_platform',
  'mcp_server',
  'vector_db',
  'prompt_registry',
  'eval_harness',
  'guardrail_system',
]);
export type AiSystemKind = z.infer<typeof AiSystemKindSchema>;

// --------------------------------------------------------------------------
// Per-kind intake schemas. These are *minimal* but structured: each captures
// the fields a Lead Auditor needs to evidence ISO 42001 clauses 6.1, 7.5, and
// Annex A controls (especially A.6.2 system life-cycle and A.7 data) for that
// kind of system. Optional fields surface as "missing-data flags" via
// AiSystemProfiler.
// --------------------------------------------------------------------------

const TrainingDataCategoriesSchema = z.array(
  z.enum([
    'public_web',
    'licensed_proprietary',
    'user_generated',
    'synthetic',
    'pii_present',
    'phi_present',
    'biometric',
    'children_data',
    'copyrighted',
    'confidential_business',
    'unknown',
  ]),
);

const PredictiveMlIntake = z.object({
  kind: z.literal('predictive_ml'),
  task_type: z.enum(['classification', 'regression', 'clustering', 'ranking', 'anomaly']),
  algorithm_family: z.string().min(1).max(120).optional(),
  feature_count: z.number().int().nonnegative().optional(),
  training_data_categories: TrainingDataCategoriesSchema.optional(),
  protected_attributes_used: z.array(z.string()).optional(),
  performance_metrics: z.record(z.string(), z.number()).optional(),
});

const GenerativeLlmIntake = z.object({
  kind: z.literal('generative_llm'),
  model_family: z.string().min(1).max(120),
  parameter_count: z.number().int().positive().optional(),
  context_window: z.number().int().positive().optional(),
  training_data_categories: TrainingDataCategoriesSchema.optional(),
  fine_tuned_from: z.string().max(240).optional(),
  rlhf_applied: z.boolean().optional(),
  output_modalities: z.array(z.enum(['text', 'image', 'audio', 'video', 'code'])).optional(),
});

const FoundationModelIntake = z.object({
  kind: z.literal('foundation_model'),
  model_family: z.string().min(1).max(120),
  parameter_count: z.number().int().positive().optional(),
  training_compute_flops: z.number().positive().optional(),
  systemic_risk_flag: z.boolean().optional(),
  training_data_categories: TrainingDataCategoriesSchema.optional(),
});

const EdgeModelIntake = z.object({
  kind: z.literal('edge_model'),
  hardware_target: z.string().min(1).max(120),
  quantization: z.enum(['fp32', 'fp16', 'int8', 'int4', 'mixed', 'none']).optional(),
  ota_update_supported: z.boolean().optional(),
  offline_capable: z.boolean().optional(),
});

const MultimodalIntake = z.object({
  kind: z.literal('multimodal'),
  input_modalities: z.array(z.enum(['text', 'image', 'audio', 'video', 'sensor'])).min(2),
  output_modalities: z.array(z.enum(['text', 'image', 'audio', 'video', 'code'])).min(1),
  model_family: z.string().min(1).max(120).optional(),
});

const AgentBaseFields = {
  tool_count: z.number().int().nonnegative(),
  autonomy_level: AutonomyLevelSchema,
  persistent_memory_flag: z.boolean(),
  escalation_paths: z.array(z.string().min(1)).default([]),
  underlying_llm: z.string().max(240).optional(),
  max_loop_iterations: z.number().int().positive().optional(),
} as const;

const AgentAssistantIntake = z.object({
  kind: z.literal('agent_assistant'),
  ...AgentBaseFields,
});
const ToolUsingAgentIntake = z.object({
  kind: z.literal('tool_using_agent'),
  ...AgentBaseFields,
  tool_categories: z
    .array(z.enum(['read', 'write', 'execute', 'destructive', 'financial', 'communication']))
    .min(1),
});
const RagAgentIntake = z.object({
  kind: z.literal('rag_agent'),
  ...AgentBaseFields,
  retrieval_sources: z.array(z.string().min(1)).default([]),
  retrieval_freshness: z.enum(['static', 'periodic', 'live']).optional(),
});
const BrowserAgentIntake = z.object({
  kind: z.literal('browser_agent'),
  ...AgentBaseFields,
  domains_allowed: z.array(z.string()).default([]),
  domains_denied: z.array(z.string()).default([]),
  credentials_handling: z.enum(['none', 'session_pass_through', 'vault']).optional(),
});
const CodeAgentIntake = z.object({
  kind: z.literal('code_agent'),
  ...AgentBaseFields,
  sandbox: z.enum(['none', 'container', 'vm', 'firecracker', 'wasm']).optional(),
  network_egress: z.enum(['none', 'allowlist', 'open']).optional(),
});
const MultiAgentWorkflowIntake = z.object({
  kind: z.literal('multi_agent_workflow'),
  ...AgentBaseFields,
  orchestration_pattern: z.enum(['supervisor', 'swarm', 'pipeline', 'choreography', 'auction']),
  agent_count: z.number().int().positive(),
});
const AutonomousLoopIntake = z.object({
  kind: z.literal('autonomous_loop'),
  ...AgentBaseFields,
  termination_criteria: z.array(z.string().min(1)).min(1),
  budget_caps: z
    .object({ max_tokens: z.number().int().positive().optional(), max_usd: z.number().positive().optional() })
    .optional(),
});
const HitlWorkflowIntake = z.object({
  kind: z.literal('hitl_workflow'),
  ...AgentBaseFields,
  human_gate_count: z.number().int().nonnegative(),
  gate_sla_seconds: z.number().int().positive().optional(),
});
const LongHorizonAgentIntake = z.object({
  kind: z.literal('long_horizon_agent'),
  ...AgentBaseFields,
  planning_horizon_steps: z.number().int().positive(),
  checkpointing: z.boolean().optional(),
});
const CrossSystemAgentIntake = z.object({
  kind: z.literal('cross_system_agent'),
  ...AgentBaseFields,
  external_systems: z.array(z.string().min(1)).min(1),
  trust_boundaries: z.array(z.string()).default([]),
});

const TrainingPipelineIntake = z.object({
  kind: z.literal('training_pipeline'),
  framework: z.string().min(1).max(120),
  experiment_tracking: z.enum(['mlflow', 'wandb', 'comet', 'neptune', 'none']).optional(),
  reproducibility_artifacts: z
    .array(z.enum(['code_hash', 'data_hash', 'env_lock', 'seed', 'hardware_log']))
    .default([]),
  data_lineage_tracked: z.boolean().optional(),
});
const InferencePlatformIntake = z.object({
  kind: z.literal('inference_platform'),
  serving_framework: z.string().min(1).max(120),
  hosted_models_count: z.number().int().nonnegative(),
  multitenancy: z.enum(['single', 'logical', 'physical']).optional(),
  rate_limit_per_tenant: z.boolean().optional(),
});
const McpServerIntake = z.object({
  kind: z.literal('mcp_server'),
  exposed_tools: z.array(z.string().min(1)).default([]),
  exposed_resources: z.array(z.string().min(1)).default([]),
  auth_method: z.enum(['none', 'api_key', 'oauth', 'mtls']).optional(),
});
const VectorDbIntake = z.object({
  kind: z.literal('vector_db'),
  engine: z.string().min(1).max(120),
  embedding_models: z.array(z.string().min(1)).default([]),
  pii_in_index: z.boolean().optional(),
  retention_days: z.number().int().nonnegative().optional(),
});
const PromptRegistryIntake = z.object({
  kind: z.literal('prompt_registry'),
  versioning_scheme: z.enum(['semver', 'hash', 'timestamp', 'none']),
  approval_workflow: z.boolean().optional(),
  prompt_count: z.number().int().nonnegative().optional(),
});
const EvalHarnessIntake = z.object({
  kind: z.literal('eval_harness'),
  eval_suites: z.array(z.string().min(1)).default([]),
  scheduled: z.boolean().optional(),
  blocking_on_regression: z.boolean().optional(),
});
const GuardrailSystemIntake = z.object({
  kind: z.literal('guardrail_system'),
  guardrail_categories: z
    .array(z.enum(['toxicity', 'pii', 'prompt_injection', 'jailbreak', 'topic', 'regex', 'policy']))
    .min(1),
  fail_mode: z.enum(['block', 'rewrite', 'flag', 'log_only']),
});

/**
 * Discriminated-union intake — exactly one variant per AiSystem.
 *
 * Note: Zod v3 union narrows on the literal `kind` discriminator; consumers
 * may pattern-match safely after parsing.
 */
export const AiSystemIntakeSchema = z.discriminatedUnion('kind', [
  PredictiveMlIntake,
  GenerativeLlmIntake,
  FoundationModelIntake,
  EdgeModelIntake,
  MultimodalIntake,
  AgentAssistantIntake,
  ToolUsingAgentIntake,
  RagAgentIntake,
  BrowserAgentIntake,
  CodeAgentIntake,
  MultiAgentWorkflowIntake,
  AutonomousLoopIntake,
  HitlWorkflowIntake,
  LongHorizonAgentIntake,
  CrossSystemAgentIntake,
  TrainingPipelineIntake,
  InferencePlatformIntake,
  McpServerIntake,
  VectorDbIntake,
  PromptRegistryIntake,
  EvalHarnessIntake,
  GuardrailSystemIntake,
]);
export type AiSystemIntake = z.infer<typeof AiSystemIntakeSchema>;

export const AGENT_KINDS: ReadonlySet<AiSystemKind> = new Set<AiSystemKind>([
  'agent_assistant',
  'tool_using_agent',
  'rag_agent',
  'browser_agent',
  'code_agent',
  'multi_agent_workflow',
  'autonomous_loop',
  'hitl_workflow',
  'long_horizon_agent',
  'cross_system_agent',
]);

export const MODEL_KINDS: ReadonlySet<AiSystemKind> = new Set<AiSystemKind>([
  'predictive_ml',
  'generative_llm',
  'foundation_model',
  'edge_model',
  'multimodal',
]);

export const PLATFORM_KINDS: ReadonlySet<AiSystemKind> = new Set<AiSystemKind>([
  'training_pipeline',
  'inference_platform',
  'mcp_server',
  'vector_db',
  'prompt_registry',
  'eval_harness',
  'guardrail_system',
]);

export function isAgentKind(kind: AiSystemKind): boolean {
  return AGENT_KINDS.has(kind);
}
export function isModelKind(kind: AiSystemKind): boolean {
  return MODEL_KINDS.has(kind);
}
export function isPlatformKind(kind: AiSystemKind): boolean {
  return PLATFORM_KINDS.has(kind);
}
