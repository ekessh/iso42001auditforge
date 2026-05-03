// SPDX-License-Identifier: BUSL-1.1
/**
 * ParallelNcDrafter
 * -----------------
 * Subscribes to confirmed claim attribution events. Runs the detector pipeline
 * over the recent claim window. For each detector signal, it materialises a
 * CandidateFinding by running a NC drafting prompt on a medium-tier LLM. All
 * LLM-generated text is validated against the CandidateFinding schema before
 * acceptance.
 *
 * Hard rules enforced here:
 *   - Detectors run before any LLM call (deterministic gate).
 *   - LLM output is schema-validated; on validation failure, the candidate is
 *     dropped and a structured error returned instead of being persisted.
 *   - Status starts as 'pending'. Only auditor-issued PromotionRequests change
 *     state; this service never produces 'promoted' rows.
 *   - Candidate findings carry the model invocation ID and prompt template
 *     version so they can be revisited or cited in the audit ledger.
 */
import { z } from 'zod';
import type {
  CandidateFinding,
  CandidateFindingType,
  NewCandidateFinding,
} from '../domain/candidate-finding.js';
import {
  CandidateFindingSchema,
  CandidateFindingTypeSchema,
} from '../domain/candidate-finding.js';
import type { Claim, ContradictionPair } from '../domain/claim.js';
import type {
  Detector,
  DetectorContext,
  DetectorSignal,
} from '../detectors/detector.js';

/** Versioned prompt template ID, kept here as the canonical reference. */
export const NC_DRAFTING_PROMPT_TEMPLATE_VERSION = 'nc_drafting.v1.0.0';

/** Schema for the fields the LLM is responsible for filling. */
export const LlmDraftPayloadSchema = z.object({
  draftStatement: z.string().min(20).max(2_000),
  proposedSeverityRationale: z.string().min(10).max(2_000),
  /** LLM may refine the type; must be one of the canonical values. */
  proposedType: CandidateFindingTypeSchema.optional(),
  /** Confidence override in [0,1]. */
  confidence: z.number().min(0).max(1).optional(),
  /** Suggested root-cause prompt categories, may augment detector list. */
  suggestedRootCausePrompts: z.array(z.string().min(1).max(500)).max(10).optional(),
});
export type LlmDraftPayload = z.infer<typeof LlmDraftPayloadSchema>;

export interface AttributionConfirmedEvent {
  readonly engagementId: string;
  readonly firmId: string;
  readonly claim: Claim;
  readonly contradictions?: readonly ContradictionPair[];
  readonly at: string;
}

export interface DrafterRunInput {
  readonly windowClaims: readonly Claim[];
  readonly contradictions?: readonly ContradictionPair[];
}

export interface DrafterDeps {
  readonly detectors: readonly Detector[];
  readonly llm: NcDraftingLlm;
  readonly idGen: () => string;
  readonly clock: () => string;
}

export interface NcDraftingLlm {
  /** Returns a structured payload validated against LlmDraftPayloadSchema. */
  draft(args: NcDraftLlmArgs): Promise<NcDraftLlmResult>;
}

export interface NcDraftLlmArgs {
  readonly signal: DetectorSignal;
  readonly claims: readonly Claim[];
  readonly engagementId: string;
  readonly promptTemplateVersion: string;
}

export interface NcDraftLlmResult {
  readonly modelInvocationId: string;
  readonly payload: unknown;
}

export interface DrafterRunOutput {
  readonly created: readonly CandidateFinding[];
  /** Signals dropped because LLM output failed schema validation. */
  readonly dropped: readonly DropRecord[];
}

export interface DropRecord {
  readonly detectorId: string;
  readonly reason: string;
  readonly modelInvocationId: string | null;
}

export class ParallelNcDrafter {
  constructor(private readonly deps: DrafterDeps) {}

  async run(
    input: DrafterRunInput,
    ctx: DetectorContext,
  ): Promise<DrafterRunOutput> {
    const detectorInput = {
      claims: input.windowClaims,
      contradictions: input.contradictions ?? [],
    };
    const signals: DetectorSignal[] = [];
    for (const detector of this.deps.detectors) {
      const out = detector.detect(detectorInput, ctx);
      for (const s of out) signals.push(s);
    }

    const created: CandidateFinding[] = [];
    const dropped: DropRecord[] = [];

    for (const signal of signals) {
      const claimsForSignal = input.windowClaims.filter((c) =>
        signal.sourceClaimIds.includes(c.id),
      );
      let modelInvocationId: string | null = null;
      try {
        const llmRes = await this.deps.llm.draft({
          signal,
          claims: claimsForSignal,
          engagementId: ctx.engagementId,
          promptTemplateVersion: NC_DRAFTING_PROMPT_TEMPLATE_VERSION,
        });
        modelInvocationId = llmRes.modelInvocationId;
        const parsed = LlmDraftPayloadSchema.safeParse(llmRes.payload);
        if (!parsed.success) {
          dropped.push({
            detectorId: signal.detectorId,
            reason: `llm_schema_validation: ${parsed.error.issues
              .map((i) => `${i.path.join('.')}:${i.message}`)
              .join(';')}`,
            modelInvocationId,
          });
          continue;
        }
        const candidate = this.materialise(signal, parsed.data, ctx, modelInvocationId);
        const validated = CandidateFindingSchema.safeParse(candidate);
        if (!validated.success) {
          dropped.push({
            detectorId: signal.detectorId,
            reason: `candidate_schema_validation: ${validated.error.issues
              .map((i) => `${i.path.join('.')}:${i.message}`)
              .join(';')}`,
            modelInvocationId,
          });
          continue;
        }
        created.push(validated.data);
      } catch (err) {
        dropped.push({
          detectorId: signal.detectorId,
          reason: `llm_invocation_error: ${err instanceof Error ? err.message : String(err)}`,
          modelInvocationId,
        });
      }
    }

    return { created, dropped };
  }

  private materialise(
    signal: DetectorSignal,
    payload: LlmDraftPayload,
    ctx: DetectorContext,
    modelInvocationId: string,
  ): CandidateFinding {
    const type: CandidateFindingType = payload.proposedType ?? signal.type;
    const confidence = payload.confidence ?? signal.confidence;
    const rootCause = payload.suggestedRootCausePrompts ?? signal.suggestedRootCausePrompts;
    const draft: NewCandidateFinding = {
      id: this.deps.idGen(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      type,
      draftStatement: payload.draftStatement,
      linkedClauses: [...signal.clauseIds],
      linkedControls: [...signal.controlIds],
      sourceClaimIds: [...signal.sourceClaimIds],
      sourceEpisodeIds: [...signal.sourceEpisodeIds],
      confidence,
      suggestedRootCausePrompts: [...rootCause],
      proposedSeverityRationale: payload.proposedSeverityRationale,
      modelInvocationId,
      detectorId: signal.detectorId,
      promptTemplateVersion: NC_DRAFTING_PROMPT_TEMPLATE_VERSION,
    };

    return {
      ...draft,
      id: draft.id!,
      status: 'pending',
      createdAt: this.deps.clock(),
      decidedBy: null,
      decidedAt: null,
      dismissalReason: null,
    } as CandidateFinding;
  }
}
