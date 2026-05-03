// SPDX-License-Identifier: BUSL-1.1
/**
 * SystemicPatternDetector
 * -----------------------
 * Pattern: the same control fails across multiple sampled units. We define
 * "fails" as any claim with controlImplemented === false or polarity ===
 * denies attributing to that clause/control.
 *
 * Threshold: 2 or more distinct sampleUnitIds against the same clause +
 * control combination. Output: Major NC (systemic) per ISO 17021-1
 * 9.4.8 — multiple instances elevate the finding to systemic non-conformity.
 */
import type {
  Detector,
  DetectorContext,
  DetectorInput,
  DetectorSignal,
} from './detector.js';

const ID = 'detector.systemic_pattern.v1';
const THRESHOLD = 2;

interface Bucket {
  readonly clauseId: string;
  readonly controlId: string | null;
  readonly sampleUnits: Set<string>;
  readonly claimIds: string[];
  readonly episodeIds: string[];
}

function bucketKey(clauseId: string, controlId: string | null): string {
  return `${clauseId}|${controlId ?? '_'}`;
}

export class SystemicPatternDetector implements Detector {
  readonly id = ID;

  detect(
    input: DetectorInput,
    ctx: DetectorContext,
  ): readonly DetectorSignal[] {
    const buckets = new Map<string, Bucket>();
    for (const claim of input.claims) {
      if (claim.controlImplemented !== false && claim.polarity !== 'denies') {
        continue;
      }
      if (!claim.sampleUnitId) continue;
      for (const a of claim.attributions) {
        if (a.confidence < 0.5) continue;
        if (!ctx.clauseCatalog.isValid(a.clauseId)) continue;
        const key = bucketKey(a.clauseId, a.controlId);
        let b = buckets.get(key);
        if (!b) {
          b = {
            clauseId: a.clauseId,
            controlId: a.controlId,
            sampleUnits: new Set<string>(),
            claimIds: [],
            episodeIds: [],
          };
          buckets.set(key, b);
        }
        b.sampleUnits.add(claim.sampleUnitId);
        b.claimIds.push(claim.id);
        b.episodeIds.push(claim.episodeId);
      }
    }

    const out: DetectorSignal[] = [];
    for (const b of buckets.values()) {
      if (b.sampleUnits.size < THRESHOLD) continue;
      out.push({
        detectorId: ID,
        type: 'major_nc',
        clauseIds: [b.clauseId],
        controlIds: b.controlId ? [b.controlId] : [],
        sourceClaimIds: b.claimIds,
        sourceEpisodeIds: Array.from(new Set(b.episodeIds)),
        confidence: 0.9,
        rationale: `Same control failure observed across ${b.sampleUnits.size} sampled units (${Array.from(b.sampleUnits).join(', ')}) on ${b.clauseId}. Systemic per ISO 17021-1 9.4.8.`,
        suggestedRootCausePrompts: [
          'process_design',
          'organizational_governance',
          'control_effectiveness',
        ],
        tags: ['systemic', b.clauseId, b.controlId ?? '_'],
      });
    }
    return out;
  }
}
