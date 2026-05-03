// SPDX-License-Identifier: BUSL-1.1
/**
 * Candidate-finding promotion mapper.
 *
 * Consumers (the orchestrator app) call this to convert a CandidateFinding +
 * PromotionRequest into a v2 Finding-creation payload. The actual write goes
 * through `@auditforge/findings`; we deliberately avoid taking that package as
 * a dependency to keep the boundary clean and the package lightweight.
 */
import type {
  CandidateFinding,
  CandidateFindingType,
  PromotionRequest,
} from '../domain/candidate-finding.js';

/** Subset of the v2 CreateFindingInput we can populate from a candidate. */
export interface MappedFindingInput {
  readonly firmId: string;
  readonly clientId: string;
  readonly engagementId: string;
  readonly auditEventId: string;
  readonly type: 'major_nc' | 'minor_nc' | 'ofi' | 'conformity';
  readonly clauseLinks: readonly { framework: string; clauseId: string }[];
  readonly controlLinks: readonly { controlId: string }[];
  readonly evidenceLinks: readonly { evidenceId: string }[];
  readonly statementText: string;
  readonly requirementText: string;
  readonly rootCausePromptResponse: string;
  readonly raisedBy: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly riskRating: 1 | 2 | 3 | 4 | 5;
  readonly topicTags: readonly string[];
}

/** Mapping of candidate type → v2 finding type. Observation collapses to OFI. */
export function mapCandidateType(
  t: CandidateFindingType,
): 'major_nc' | 'minor_nc' | 'ofi' {
  if (t === 'observation') return 'ofi';
  return t;
}

export function severityForType(
  t: ReturnType<typeof mapCandidateType>,
): 'low' | 'medium' | 'high' | 'critical' {
  if (t === 'major_nc') return 'high';
  if (t === 'minor_nc') return 'medium';
  return 'low';
}

export function riskRatingForType(
  t: ReturnType<typeof mapCandidateType>,
): 1 | 2 | 3 | 4 | 5 {
  if (t === 'major_nc') return 4;
  if (t === 'minor_nc') return 2;
  return 1;
}

export interface MapPromotionInput {
  readonly candidate: CandidateFinding;
  readonly request: PromotionRequest;
  /** Required to populate v2 evidenceLinks; resolved by the caller from
   * source claims via the audit-memory layer. */
  readonly evidenceIds: readonly string[];
  /** v2 framework label — almost always "ISO_42001". */
  readonly framework: string;
}

export function mapPromotionToFindingInput(
  input: MapPromotionInput,
): MappedFindingInput {
  if (input.candidate.id !== input.request.candidateFindingId) {
    throw new Error(
      'mapPromotionToFindingInput: candidate ID does not match promotion request',
    );
  }
  if (input.candidate.status === 'dismissed') {
    throw new Error('Cannot promote a dismissed candidate finding');
  }
  if (input.candidate.status === 'promoted') {
    throw new Error('Candidate finding already promoted');
  }

  const overrides = input.request.overrides ?? {};
  const type = mapCandidateType(overrides.type ?? input.candidate.type);
  const severity = severityForType(type);
  const riskRating = riskRatingForType(type);

  const clauseIds = overrides.linkedClauses ?? input.candidate.linkedClauses;
  const controlIds = overrides.linkedControls ?? input.candidate.linkedControls;

  return {
    firmId: input.candidate.firmId,
    clientId: input.request.clientId,
    engagementId: input.candidate.engagementId,
    auditEventId: input.request.auditEventId,
    type,
    clauseLinks: clauseIds.map((c) => ({
      framework: input.framework,
      clauseId: c,
    })),
    controlLinks: controlIds.map((c) => ({ controlId: c })),
    evidenceLinks: input.evidenceIds.map((e) => ({ evidenceId: e })),
    statementText: overrides.draftStatement ?? input.candidate.draftStatement,
    requirementText: clauseIds.map((c) => `Clause ${c}`).join('; '),
    rootCausePromptResponse:
      overrides.rootCausePromptResponse ??
      `Root cause prompts: ${input.candidate.suggestedRootCausePrompts.join(', ')}`,
    raisedBy: input.request.promotedBy,
    severity,
    riskRating,
    topicTags: [
      input.candidate.detectorId,
      `from_candidate:${input.candidate.id}`,
    ],
  };
}
