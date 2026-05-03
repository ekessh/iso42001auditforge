// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema } from '../compat/shared.js';
import { AiSystemIntakeSchema, AiSystemKindSchema } from './kinds.js';
import {
  DeploymentContextSchema,
  LifecycleStageSchema,
} from './lifecycle.js';
import { EuAiActTierSchema, NistAiRmfSubcategorySchema, RiskMatchSchema } from './risk.js';

/**
 * AI System — the core record audited under ISO/IEC 42001 clause 4.3
 * (scope of the AIMS) and clause 6.1.4 (AI system impact assessment).
 *
 * The discriminated `intake` payload is what makes per-kind auditing
 * tractable: probe categories, evidence templates, and risk-tier defaults
 * are all driven by `intake.kind`.
 */
export const AiSystemSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  clientId: UuidSchema,
  engagementId: UuidSchema.optional(),

  name: z.string().min(1).max(240),
  description: z.string().max(10_000).optional(),
  kind: AiSystemKindSchema,
  intake: AiSystemIntakeSchema,

  lifecycleStage: LifecycleStageSchema,
  deploymentContext: DeploymentContextSchema,

  useCaseDescription: z.string().min(1).max(20_000),

  /** External system identifier from auditee (MLflow run, HF repo id, ...). */
  externalRef: z.string().max(480).optional(),

  /** Source of record — where this AI system was first ingested from. */
  sourceImporter: z
    .enum(['manual', 'xlsx', 'json', 'mlflow', 'wandb', 'huggingface', 'openapi'])
    .default('manual'),

  riskClassification: z
    .object({
      euAiActTier: EuAiActTierSchema.optional(),
      nistRecommendations: z.array(NistAiRmfSubcategorySchema).default([]),
      taxonomyMatches: z.array(RiskMatchSchema).default([]),
      classifiedAt: z.string().datetime().optional(),
    })
    .default({ nistRecommendations: [], taxonomyMatches: [] }),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AiSystem = z.infer<typeof AiSystemSchema>;

/**
 * Immutable snapshot of an AiSystem at a point in time. Phase-2 design
 * (§ 3.3 — versioning) requires snapshots so audit findings always
 * reference the exact state of a system when evidence was gathered.
 */
export const AiSystemVersionSchema = z.object({
  id: UuidSchema,
  aiSystemId: UuidSchema,
  version: z.number().int().positive(),
  snapshot: AiSystemSchema,
  /** SHA-256 hex digest over the canonical JSON of `snapshot`. */
  snapshotHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
  createdBy: UuidSchema,
  reason: z.string().max(2000).optional(),
});
export type AiSystemVersion = z.infer<typeof AiSystemVersionSchema>;

/** Input shape used by the registry to create an AiSystem. */
export const AiSystemCreateInputSchema = AiSystemSchema.pick({
  clientId: true,
  engagementId: true,
  name: true,
  description: true,
  kind: true,
  intake: true,
  lifecycleStage: true,
  deploymentContext: true,
  useCaseDescription: true,
  externalRef: true,
  sourceImporter: true,
});
export type AiSystemCreateInput = z.infer<typeof AiSystemCreateInputSchema>;

/** Patch shape used by the registry to update an AiSystem. */
export const AiSystemUpdateInputSchema = AiSystemSchema.pick({
  name: true,
  description: true,
  intake: true,
  lifecycleStage: true,
  deploymentContext: true,
  useCaseDescription: true,
  externalRef: true,
})
  .partial()
  .strict();
export type AiSystemUpdateInput = z.infer<typeof AiSystemUpdateInputSchema>;
