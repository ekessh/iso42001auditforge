// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema } from '../compat/shared.js';

/**
 * Probe category recommendations — these align with the seed probe
 * catalogue in design § 3.5. The profiler suggests categories based on
 * the AI system kind so auditors don't miss kind-specific tests
 * (e.g., prompt-injection probes only apply to LLM/agent kinds).
 */
export const ProbeCategorySchema = z.enum([
  'bias_fairness',
  'robustness_adversarial',
  'hallucination_rate',
  'prompt_injection',
  'data_leakage',
  'output_toxicity',
  'output_pii_leakage',
  'jailbreak_resistance',
  'refusal_accuracy',
  'capability_evaluation',
  'drift_detection',
  'energy_cost',
  'tool_permission_drift',
  'loop_recursion_bound',
  'human_gate_respect',
  'memory_isolation',
  'consent_respect',
  'explanation_faithfulness',
]);
export type ProbeCategory = z.infer<typeof ProbeCategorySchema>;

export const MissingDataFlagSchema = z.object({
  field: z.string().min(1),
  severity: z.enum(['info', 'warn', 'block']),
  reason: z.string().min(1).max(2000),
});
export type MissingDataFlag = z.infer<typeof MissingDataFlagSchema>;

export const InferredFieldSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['rule', 'heuristic', 'importer_default']),
});
export type InferredField = z.infer<typeof InferredFieldSchema>;

/**
 * Output of `AiSystemProfiler.profile()` — a structured profile that the
 * UI can render as the auditor's "AI system at a glance" card and that
 * downstream services (probe runner, working-paper templates) consume.
 */
export const AiSystemProfileSchema = z.object({
  aiSystemId: UuidSchema,
  generatedAt: z.string().datetime(),
  inferredFields: z.array(InferredFieldSchema),
  missingDataFlags: z.array(MissingDataFlagSchema),
  suggestedProbeCategories: z.array(ProbeCategorySchema),
  suggestedAnnexAControls: z.array(z.string().regex(/^A\.\d+(\.\d+){0,3}$/)),
  /** A 0..100 score indicating how complete the intake is (auditor UX hint). */
  completenessScore: z.number().min(0).max(100),
});
export type AiSystemProfile = z.infer<typeof AiSystemProfileSchema>;
