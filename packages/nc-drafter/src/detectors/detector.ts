// SPDX-License-Identifier: BUSL-1.1
/**
 * Detector interface and shared types used by the Parallel NC Drafter.
 *
 * A detector is a deterministic, pure function over a window of recent claims
 * + the engagement context. It returns DetectorSignal objects: lightweight
 * draft hints that the drafter will combine with an LLM-generated NC
 * statement to materialise a CandidateFinding.
 *
 * Detectors do NOT call the LLM. They never write to storage. They never
 * mutate input. They are unit-testable in isolation against golden fixtures.
 */
import type {
  AuditType,
  CandidateFindingType,
} from '../domain/candidate-finding.js';
import type { ClauseCatalog } from '../domain/clause-catalog.js';
import type {
  Claim,
  ContradictionPair,
  ExpectedEvidenceBlock,
} from '../domain/claim.js';

export interface DetectorContext {
  readonly engagementId: string;
  readonly firmId: string;
  readonly auditType: AuditType;
  readonly clauseCatalog: ClauseCatalog;
  /** ISO date — used for createdAt + telemetry. */
  readonly now: string;
  /** When set, sampled-units context for the systemic-pattern detector. */
  readonly sampleUnitsInScope?: readonly string[];
  /** Audit-plan blocks: required for evidence-absence detector. */
  readonly expectedEvidenceBlocks?: readonly ExpectedEvidenceBlock[];
}

export interface DetectorSignal {
  readonly detectorId: string;
  readonly type: CandidateFindingType;
  readonly clauseIds: readonly string[];
  readonly controlIds: readonly string[];
  readonly sourceClaimIds: readonly string[];
  readonly sourceEpisodeIds: readonly string[];
  /** Initial confidence — drafter may adjust after LLM contextualisation. */
  readonly confidence: number;
  /** Short rationale used both for severity reasoning and prompt context. */
  readonly rationale: string;
  /** Suggested root-cause prompt categories per ISO 17021-1 9.4. */
  readonly suggestedRootCausePrompts: readonly string[];
  /** Free-form keywords used by the systemic-pattern detector to dedupe. */
  readonly tags: readonly string[];
}

export interface DetectorInput {
  readonly claims: readonly Claim[];
  readonly contradictions?: readonly ContradictionPair[];
}

export interface Detector {
  readonly id: string;
  detect(input: DetectorInput, ctx: DetectorContext): readonly DetectorSignal[];
}

export function severityForClause(
  ctx: DetectorContext,
  clauseId: string,
): 'high' | 'medium' | 'low' {
  const meta = ctx.clauseCatalog.get(clauseId);
  return meta ? meta.severity : 'medium';
}

export function isMandatory(
  ctx: DetectorContext,
  clauseId: string,
): boolean {
  const meta = ctx.clauseCatalog.get(clauseId);
  return meta?.mandatory ?? false;
}
