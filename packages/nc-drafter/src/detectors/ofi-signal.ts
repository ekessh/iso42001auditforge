// SPDX-License-Identifier: BUSL-1.1
/**
 * OfiSignalDetector
 * -----------------
 * Pattern: a process is described as fragile / manual / undocumented but
 * still functioning (claim.functioning === true and processMaturity in
 * {fragile, manual, undocumented}). Not a non-conformity, but an OFI per
 * ISO 17021-1 9.4.8.
 *
 * Confidence: 0.65 — opportunities are inherently softer signals.
 */
import type {
  Detector,
  DetectorContext,
  DetectorInput,
  DetectorSignal,
} from './detector.js';

const ID = 'detector.ofi_signal.v1';
const OFI_MATURITIES = new Set([
  'fragile',
  'manual',
  'undocumented',
]);

export class OfiSignalDetector implements Detector {
  readonly id = ID;

  detect(
    input: DetectorInput,
    ctx: DetectorContext,
  ): readonly DetectorSignal[] {
    const out: DetectorSignal[] = [];
    for (const claim of input.claims) {
      if (claim.functioning !== true) continue;
      if (claim.processMaturity == null) continue;
      if (!OFI_MATURITIES.has(claim.processMaturity)) continue;
      if (claim.attributions.length === 0) continue;

      const primary = [...claim.attributions].sort(
        (a, b) => b.confidence - a.confidence,
      )[0];
      if (!primary) continue;
      if (!ctx.clauseCatalog.isValid(primary.clauseId)) continue;

      const controlIds = claim.attributions
        .map((a) => a.controlId)
        .filter((c): c is string => c != null);

      out.push({
        detectorId: ID,
        type: 'ofi',
        clauseIds: claim.attributions.map((a) => a.clauseId),
        controlIds,
        sourceClaimIds: [claim.id],
        sourceEpisodeIds: [claim.episodeId],
        confidence: 0.65,
        rationale: `Process described as ${claim.processMaturity} but functioning. Opportunity for improvement on ${primary.clauseId}.`,
        suggestedRootCausePrompts: [
          'automation_potential',
          'documentation_uplift',
          'resilience_review',
        ],
        tags: ['ofi', primary.clauseId, claim.processMaturity],
      });
    }
    return out;
  }
}
