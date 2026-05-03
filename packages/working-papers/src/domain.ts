// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  Sha256HexSchema,
  TenantContextSchema,
  UuidSchema,
} from '@auditforge/shared';

/**
 * Verdict literal — the state machine in `verdict.ts` constrains transitions.
 */
export const VerdictSchema = z.enum([
  'conformant',
  'minor_nc',
  'major_nc',
  'ofi',
  'na',
]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const ConfidenceSchema = z
  .number()
  .int()
  .min(0)
  .max(100);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * Scope of a working paper. Exactly one ref must be set — papers attach to a
 * clause OR an Annex-A control OR an AI system. Validation enforces this.
 */
export const WpScopeSchema = z
  .object({
    clauseId: z.string().min(1).optional(),
    controlId: z.string().min(1).optional(),
    aiSystemId: UuidSchema.optional(),
  })
  .refine(
    (s) =>
      [s.clauseId, s.controlId, s.aiSystemId].filter(Boolean).length === 1,
    { message: 'WpScope must have exactly one of clauseId | controlId | aiSystemId' },
  );
export type WpScope = z.infer<typeof WpScopeSchema>;

export const WpEvidenceLinkTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('evidence'), evidenceId: UuidSchema }),
  z.object({ kind: z.literal('sample'), sampleId: UuidSchema }),
  z.object({ kind: z.literal('probeExecution'), probeExecutionId: UuidSchema }),
  z.object({ kind: z.literal('trace'), traceId: UuidSchema }),
]);
export type WpEvidenceLinkTarget = z.infer<typeof WpEvidenceLinkTargetSchema>;

export const WpEvidenceLinkSchema = z.object({
  id: UuidSchema,
  workingPaperId: UuidSchema,
  target: WpEvidenceLinkTargetSchema,
  note: z.string().max(2000).optional(),
  addedAt: IsoDateSchema,
  addedBy: UuidSchema,
});
export type WpEvidenceLink = z.infer<typeof WpEvidenceLinkSchema>;

export const WpObservationSchema = z.object({
  id: UuidSchema,
  workingPaperId: UuidSchema,
  text: NonEmptyStringSchema,
  severity: z.enum(['info', 'minor', 'major']),
  authorId: UuidSchema,
  createdAt: IsoDateSchema,
  evidenceLinkIds: z.array(UuidSchema).default([]),
});
export type WpObservation = z.infer<typeof WpObservationSchema>;

/**
 * A working paper's runtime state. `content` carries an opaque CRDT snapshot
 * (Y.encodeStateAsUpdate) — never the structured Yjs doc. Tenant isolation is
 * enforced via firmId + engagementId.
 */
export const WorkingPaperSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  scope: WpScopeSchema,
  templateId: NonEmptyStringSchema,
  templateVersion: z.string().min(1),
  /** opaque base64-encoded Y.Doc state vector + update */
  content: z.string(),
  /** sha-256 hex of `content`, used by the search indexer to skip unchanged docs */
  contentHash: Sha256HexSchema,
  verdict: VerdictSchema,
  confidence: ConfidenceSchema,
  authorId: UuidSchema,
  lastEditedAt: IsoDateSchema,
  /** monotonic CRDT clock — every accepted update bumps this */
  revision: z.number().int().nonnegative(),
  createdAt: IsoDateSchema,
});
export type WorkingPaper = z.infer<typeof WorkingPaperSchema>;

export const WpTemplateSectionSchema = z.object({
  id: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  prompts: z.array(NonEmptyStringSchema).default([]),
  required: z.boolean().default(false),
});
export type WpTemplateSection = z.infer<typeof WpTemplateSectionSchema>;

export const WpTemplateChecklistSchema = z.object({
  id: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
  guidance: z.string().max(4000).optional(),
});
export type WpTemplateChecklist = z.infer<typeof WpTemplateChecklistSchema>;

export const WpTemplateAppliesToSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('clause'), clauseId: NonEmptyStringSchema }),
  z.object({ kind: z.literal('annexA'), controlId: NonEmptyStringSchema }),
  z.object({
    kind: z.literal('aiSystemType'),
    systemType: z.enum([
      'llm',
      'predictive_ml',
      'agent',
      'rag',
      'multi_agent_workflow',
      'training_pipeline',
    ]),
  }),
]);
export type WpTemplateAppliesTo = z.infer<typeof WpTemplateAppliesToSchema>;

export const WpTemplateSchema = z.object({
  id: NonEmptyStringSchema,
  version: z.string().min(1),
  title: NonEmptyStringSchema,
  description: z.string().max(4000).default(''),
  appliesTo: WpTemplateAppliesToSchema,
  sections: z.array(WpTemplateSectionSchema).default([]),
  checklists: z.array(WpTemplateChecklistSchema).default([]),
  suggestedEvidenceTypes: z.array(NonEmptyStringSchema).default([]),
  suggestedProbes: z.array(NonEmptyStringSchema).default([]),
  suggestedInterviewQuestions: z.array(NonEmptyStringSchema).default([]),
  mappedClauses: z.array(NonEmptyStringSchema).default([]),
  mappedControls: z.array(NonEmptyStringSchema).default([]),
  /**
   * Variable placeholders that the editor surfaces, e.g. {{auditee.name}}.
   * Values are substituted at render time.
   */
  variables: z.array(NonEmptyStringSchema).default([]),
});
export type WpTemplate = z.infer<typeof WpTemplateSchema>;

export type WpTemplateInput = z.input<typeof WpTemplateSchema>;

export { TenantContextSchema };
export type { TenantContext } from '@auditforge/shared';
