// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

/**
 * EU AI Act risk tiers per Regulation (EU) 2024/1689.
 *
 *  - prohibited       : Article 5 prohibited practices
 *  - high_risk        : Annex III high-risk AI systems
 *  - limited_risk     : Article 50 transparency obligations only
 *  - minimal_risk     : Voluntary codes of conduct
 *  - general_purpose  : GPAI under Articles 51–55 (with or without systemic risk)
 */
export const EuAiActTierSchema = z.enum([
  'prohibited',
  'high_risk',
  'limited_risk',
  'minimal_risk',
  'general_purpose',
]);
export type EuAiActTier = z.infer<typeof EuAiActTierSchema>;

/**
 * NIST AI RMF 1.0 functions: GOVERN / MAP / MEASURE / MANAGE.
 */
export const NistAiRmfFunctionSchema = z.enum(['GOVERN', 'MAP', 'MEASURE', 'MANAGE']);
export type NistAiRmfFunction = z.infer<typeof NistAiRmfFunctionSchema>;

/**
 * NIST AI RMF subcategory recommendation (e.g., "GOVERN-1.1", "MAP-2.3").
 * The pattern is `<FUNCTION>-<MAJOR>.<MINOR>` per the AI RMF Playbook.
 */
export const NistAiRmfSubcategorySchema = z.object({
  function: NistAiRmfFunctionSchema,
  category: z.string().regex(/^[A-Z]+-\d+\.\d+$/, 'expected e.g. GOVERN-1.1'),
  rationale: z.string().min(1).max(2000),
});
export type NistAiRmfSubcategory = z.infer<typeof NistAiRmfSubcategorySchema>;

/**
 * MIT AI Risk Repository top-level domains (v1, 2024).
 * @see https://airisk.mit.edu/
 */
export const MitAirDomainSchema = z.enum([
  'discrimination_toxicity',
  'privacy_security',
  'misinformation',
  'malicious_use',
  'human_machine_interaction',
  'socioeconomic_environmental',
  'system_safety_failures',
]);
export type MitAirDomain = z.infer<typeof MitAirDomainSchema>;

/**
 * AVID (AI Vulnerability Database) SEP top-level taxonomy classes.
 * @see https://avidml.org/
 */
export const AvidCategorySchema = z.enum([
  'security',
  'ethics',
  'performance',
]);
export type AvidCategory = z.infer<typeof AvidCategorySchema>;

/**
 * MITRE ATLAS tactics — adversarial threats for ML systems.
 * @see https://atlas.mitre.org/
 */
export const AtlasTacticSchema = z.enum([
  'reconnaissance',
  'resource_development',
  'initial_access',
  'ml_model_access',
  'execution',
  'persistence',
  'defense_evasion',
  'discovery',
  'collection',
  'ml_attack_staging',
  'exfiltration',
  'impact',
]);
export type AtlasTactic = z.infer<typeof AtlasTacticSchema>;

export const RiskMatchSchema = z.object({
  category: z.string().min(1),
  framework: z.enum(['EU_AI_ACT', 'NIST_AI_RMF', 'MIT_AIR', 'AVID', 'ATLAS', 'OWASP_LLM10']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
});
export type RiskMatch = z.infer<typeof RiskMatchSchema>;
