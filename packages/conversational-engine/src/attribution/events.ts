// SPDX-License-Identifier: BUSL-1.1
//
// Attribution event publisher. The Parallel NC Drafter (packages/nc-drafter)
// subscribes to these events to detect contradictions / uncovered mandatory
// clauses / partial-evidence gaps and emit CandidateFinding drafts. Per the
// CLAUDE.md hard rule, candidate findings are never auto-promoted; the
// drafter just stages them.

import type {
  AttributionResult,
  AttributionReviewBundle,
  ContradictionRecord,
  CoverageDelta,
  ExtractedClaim,
} from '../types/domain.js';
import type { ClauseId, EngagementId, EpisodeId } from '../types/ids.js';

export type AttributionEventName =
  | 'attribution.completed'
  | 'attribution.contradiction.detected'
  | 'attribution.evidence.gap.detected'
  | 'attribution.coverage.delta';

export interface AttributionCompletedEvent {
  name: 'attribution.completed';
  engagementId: EngagementId;
  episodeId: EpisodeId;
  bundle: AttributionReviewBundle;
  deltas: readonly CoverageDelta[];
  at: string;
}

export interface ContradictionDetectedEvent {
  name: 'attribution.contradiction.detected';
  engagementId: EngagementId;
  claim: ExtractedClaim;
  contradictions: readonly ContradictionRecord[];
  at: string;
}

export interface EvidenceGapDetectedEvent {
  name: 'attribution.evidence.gap.detected';
  engagementId: EngagementId;
  episodeId: EpisodeId;
  notCoveredClauses: readonly ClauseId[];
  partialAttributions: readonly AttributionResult[];
  at: string;
}

export interface CoverageDeltaEvent {
  name: 'attribution.coverage.delta';
  engagementId: EngagementId;
  delta: CoverageDelta;
  at: string;
}

export type AttributionEvent =
  | AttributionCompletedEvent
  | ContradictionDetectedEvent
  | EvidenceGapDetectedEvent
  | CoverageDeltaEvent;

export type AttributionEventListener = (event: AttributionEvent) => void | Promise<void>;

export class AttributionEventBus {
  private readonly listeners: AttributionEventListener[] = [];

  on(listener: AttributionEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  async publish(event: AttributionEvent): Promise<void> {
    for (const l of this.listeners) {
      // WHY: serial dispatch keeps ordering deterministic for the drafter,
      // which expects contradiction events before the parent completion
      // event so it can stage the CandidateFinding while the bundle is
      // still in scope.
      await l(event);
    }
  }
}
