// SPDX-License-Identifier: BUSL-1.1
/**
 * EvidenceAbsenceDetector
 * -----------------------
 * Pattern: the audit plan expected evidence for clause X. The relevant
 * interview block ended (block.blockClosed === true). No claim attributing
 * to clause X with affirmative content was produced.
 *
 * Output: Minor NC ("objective evidence not provided") for each closed
 * block whose expected clause received no attribution. Confidence is
 * moderate (0.7) because absence is structurally weaker than denial.
 */
import type {
  Detector,
  DetectorContext,
  DetectorInput,
  DetectorSignal,
} from './detector.js';

const ID = 'detector.evidence_absence.v1';

export class EvidenceAbsenceDetector implements Detector {
  readonly id = ID;

  detect(
    input: DetectorInput,
    ctx: DetectorContext,
  ): readonly DetectorSignal[] {
    const blocks = ctx.expectedEvidenceBlocks ?? [];
    if (blocks.length === 0) return [];

    const attributedClauses = new Set<string>();
    for (const claim of input.claims) {
      if (claim.controlImplemented === false) continue;
      for (const a of claim.attributions) {
        if (a.confidence >= 0.5) attributedClauses.add(a.clauseId);
      }
    }

    const out: DetectorSignal[] = [];
    for (const block of blocks) {
      if (!block.blockClosed) continue;
      if (attributedClauses.has(block.clauseId)) continue;
      if (!ctx.clauseCatalog.isValid(block.clauseId)) continue;

      out.push({
        detectorId: ID,
        type: 'minor_nc',
        clauseIds: [block.clauseId],
        controlIds: [],
        sourceClaimIds: [],
        sourceEpisodeIds: [],
        confidence: 0.7,
        rationale: `Audit plan expected evidence types [${block.expectedTypes.join(', ')}] for ${block.clauseId}; interview block closed without affirmative attribution.`,
        suggestedRootCausePrompts: [
          'documentation_gap',
          'record_keeping',
          'evidence_retention',
        ],
        tags: ['evidence_absence', block.clauseId],
      });
    }
    return out;
  }
}
