// SPDX-License-Identifier: BUSL-1.1
/**
 * ContradictionDerivedDetector
 * ----------------------------
 * Pattern: two claims contradict each other. If the LATER claim implies a
 * control breach (controlImplemented === false OR polarity === denies),
 * raise a candidate NC. The earlier and later claims feed the evidence
 * chain so the auditor can resolve the contradiction.
 *
 * Severity follows clause severity from the catalog; default Minor unless
 * the clause is high-severity & mandatory.
 */
import type {
  Detector,
  DetectorContext,
  DetectorInput,
  DetectorSignal,
} from './detector.js';
import { isMandatory, severityForClause } from './detector.js';
import type { CandidateFindingType } from '../domain/candidate-finding.js';

const ID = 'detector.contradiction_derived.v1';

export class ContradictionDerivedDetector implements Detector {
  readonly id = ID;

  detect(
    input: DetectorInput,
    ctx: DetectorContext,
  ): readonly DetectorSignal[] {
    const pairs = input.contradictions ?? [];
    if (pairs.length === 0) return [];
    const out: DetectorSignal[] = [];
    for (const pair of pairs) {
      const later = pair.later;
      const breach =
        later.controlImplemented === false || later.polarity === 'denies';
      if (!breach) continue;
      if (!ctx.clauseCatalog.isValid(pair.contradictedClause)) continue;

      const sev = severityForClause(ctx, pair.contradictedClause);
      const mandatory = isMandatory(ctx, pair.contradictedClause);
      const type: CandidateFindingType =
        sev === 'high' && mandatory ? 'major_nc' : 'minor_nc';

      const controlIds = [
        ...later.attributions.map((a) => a.controlId),
        ...pair.earlier.attributions.map((a) => a.controlId),
      ].filter((c): c is string => c != null);

      out.push({
        detectorId: ID,
        type,
        clauseIds: [pair.contradictedClause],
        controlIds: Array.from(new Set(controlIds)),
        sourceClaimIds: [pair.earlier.id, pair.later.id],
        sourceEpisodeIds: [pair.earlier.episodeId, pair.later.episodeId],
        confidence: 0.8,
        rationale: `Later claim contradicts earlier statement on ${pair.contradictedClause} and implies control breach. clause severity=${sev}, mandatory=${mandatory}.`,
        suggestedRootCausePrompts: [
          'governance_inconsistency',
          'communication_breakdown',
          'change_control',
        ],
        tags: ['contradiction', pair.contradictedClause],
      });
    }
    return out;
  }
}
