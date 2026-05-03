// SPDX-License-Identifier: BUSL-1.1
/**
 * DirectConformityGapDetector
 * ---------------------------
 * Pattern: a claim explicitly states that a control is NOT implemented
 * (e.g. "we don't currently document model retraining decisions").
 *
 * Output: Minor or Major NC depending on:
 *   - Clause severity per the catalog (mandatory main-body high → Major)
 *   - Audit type (Stage 2 / Recertification raise severity vs Stage 1)
 *
 * Confidence is high (0.85+) because the claim itself denies implementation;
 * the only uncertainty is the clause attribution which is already gated by
 * the upstream attribution engine (we trust those scores via the claim).
 */
import type {
  Detector,
  DetectorContext,
  DetectorInput,
  DetectorSignal,
} from './detector.js';
import { isMandatory, severityForClause } from './detector.js';
import type {
  AuditType,
  CandidateFindingType,
} from '../domain/candidate-finding.js';

const ID = 'detector.direct_conformity_gap.v1';

function chooseType(
  ctx: DetectorContext,
  clauseId: string,
): CandidateFindingType {
  const sev = severityForClause(ctx, clauseId);
  const mandatory = isMandatory(ctx, clauseId);
  const escalate: AuditType[] = ['stage_2', 'recertification', 'special'];
  const escalation = escalate.includes(ctx.auditType);

  if (sev === 'high' && (mandatory || escalation)) return 'major_nc';
  if (sev === 'high') return 'minor_nc';
  if (sev === 'medium') return 'minor_nc';
  return 'ofi';
}

export class DirectConformityGapDetector implements Detector {
  readonly id = ID;

  detect(
    input: DetectorInput,
    ctx: DetectorContext,
  ): readonly DetectorSignal[] {
    const out: DetectorSignal[] = [];
    for (const claim of input.claims) {
      if (claim.controlImplemented !== false) continue;
      if (claim.polarity !== 'denies') continue;
      if (claim.attributions.length === 0) continue;

      // Use the highest-confidence attribution as the primary clause; carry
      // controls when present.
      const primary = [...claim.attributions].sort(
        (a, b) => b.confidence - a.confidence,
      )[0];
      if (!primary) continue;
      if (!ctx.clauseCatalog.isValid(primary.clauseId)) continue;

      const type = chooseType(ctx, primary.clauseId);
      const controlIds = claim.attributions
        .map((a) => a.controlId)
        .filter((c): c is string => c != null);

      out.push({
        detectorId: ID,
        type,
        clauseIds: claim.attributions.map((a) => a.clauseId),
        controlIds,
        sourceClaimIds: [claim.id],
        sourceEpisodeIds: [claim.episodeId],
        confidence: Math.max(0.85, primary.confidence),
        rationale: `Auditee denied implementation of control linked to ${primary.clauseId}; clause severity=${severityForClause(ctx, primary.clauseId)}, mandatory=${isMandatory(ctx, primary.clauseId)}, audit=${ctx.auditType}.`,
        suggestedRootCausePrompts: [
          'process_design',
          'awareness_training',
          'resource_allocation',
        ],
        tags: ['direct_gap', primary.clauseId, type],
      });
    }
    return out;
  }
}
