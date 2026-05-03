// SPDX-License-Identifier: BUSL-1.1
/**
 * Adaptive Question Evolution sub-engine — v3 §15.5 / Phase 7.7.
 *
 * Subscribes to confirmed attribution events. On every answer:
 *   a) CoverageDelta — drop priority of newly-attributed clauses, raise still-
 *      untouched ones.
 *   b) ContradictionInjector — if the new claim contradicts an earlier claim,
 *      auto-draft a contradiction-resolution question and insert it at top
 *      of the queue.
 *   c) FollowupInjector — for each high-confidence claim shape, surface
 *      pre-authored follow-ups from the library.
 *
 * Emits `AdaptiveQueueState` describing reordered, injected, and dismissed
 * queue entries. The orchestrator owns the queue itself; this module is pure
 * functional (no IO, no LLM calls — it deliberately uses pre-authored library
 * content as required by the engine hard rules).
 */
import { randomUUID } from 'node:crypto';
import {
  type AdaptiveClaim,
  type AdaptiveQueueState,
  type AttributionConfirmedEvent,
  type CoverageMap,
  type FollowupTemplate,
  type QueuedQuestion,
} from './adaptive-types.js';

export interface AdaptiveDeps {
  /** Returns library follow-up templates matching a claim shape. */
  followupLibrary: {
    findByShape(shape: string): readonly FollowupTemplate[];
  };
  /** ID generator for newly-injected questions. */
  idGen?: () => string;
}

const DEFAULT_DEPS: Required<Pick<AdaptiveDeps, 'idGen'>> = {
  idGen: () => randomUUID(),
};

const HIGH_CONF_THRESHOLD = 0.85;
const FOLLOWUP_INJECT_BASE_PRIORITY = 0.7;
const CONTRADICTION_TOP_PRIORITY = 0.99;
const COVERAGE_DROP_FACTOR = 0.4; // newly attributed clauses drop to 40% priority
const COVERAGE_RAISE_FACTOR = 1.15; // untouched clauses get a 15% bump

export class AdaptiveQuestionEvolution {
  private readonly deps: Required<AdaptiveDeps>;

  constructor(deps: AdaptiveDeps) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  /**
   * Apply all three reflow steps for a single confirmed attribution event.
   *
   * @param queue       Current queue entries (mutable copy will be made).
   * @param event       The confirmed attribution event triggering reflow.
   * @param coverage    Current coverage map; used by the CoverageDelta step.
   */
  apply(
    queue: readonly QueuedQuestion[],
    event: AttributionConfirmedEvent,
    coverage: CoverageMap,
  ): AdaptiveQueueState {
    const reordered = this.applyCoverageDelta(queue, event.claim, coverage);
    const injected: QueuedQuestion[] = [];

    const contradiction = this.maybeInjectContradiction(event.claim);
    if (contradiction) injected.push(contradiction);

    const followups = this.injectFollowups(event.claim);
    injected.push(...followups);

    return {
      reorderedQuestions: reordered,
      injectedQuestions: injected,
      dismissedFromQueueIds: [],
    };
  }

  /** (a) CoverageDelta: lower priority for clauses just attributed; raise
   *  for still-untouched ones. Pinned questions are unchanged. */
  applyCoverageDelta(
    queue: readonly QueuedQuestion[],
    claim: AdaptiveClaim,
    coverage: CoverageMap,
  ): QueuedQuestion[] {
    const justAttributed = new Set<string>();
    for (const a of claim.attributions) {
      if (a.confidence >= HIGH_CONF_THRESHOLD) justAttributed.add(a.clauseId);
    }
    const out: QueuedQuestion[] = [];
    for (const q of queue) {
      if (q.pinned) {
        out.push(q);
        continue;
      }
      let factor = 1.0;
      if (q.targetClauses.some((c) => justAttributed.has(c))) {
        factor = COVERAGE_DROP_FACTOR;
      } else if (q.targetClauses.some((c) => coverage[c] === 'untouched')) {
        factor = COVERAGE_RAISE_FACTOR;
      }
      out.push({ ...q, priority: clamp01(q.priority * factor) });
    }
    out.sort((a, b) => b.priority - a.priority);
    return out;
  }

  /** (b) ContradictionInjector: when a contradiction is flagged, auto-draft
   *  a contradiction-resolution question with maximum priority. */
  maybeInjectContradiction(claim: AdaptiveClaim): QueuedQuestion | null {
    if (!claim.contradicts) return null;
    return {
      id: this.deps.idGen() as string,
      libraryQuestionId: null,
      kind: 'contradiction_resolution',
      text:
        `Earlier you indicated something different about ${claim.contradicts.contradictedClause}. ` +
        `Can you reconcile the two statements? Specifically: which version is current today?`,
      targetClauses: [claim.contradicts.contradictedClause],
      priority: CONTRADICTION_TOP_PRIORITY,
      sourceClaimId: claim.id,
      shape: 'contradiction',
      pinned: false,
    };
  }

  /** (c) FollowupInjector: for high-confidence claim shapes, surface pre-
   *  authored library follow-ups. */
  injectFollowups(claim: AdaptiveClaim): QueuedQuestion[] {
    if (!claim.shape) return [];
    const highConf = claim.attributions.some(
      (a) => a.confidence >= HIGH_CONF_THRESHOLD,
    );
    if (!highConf) return [];
    const templates = this.deps.followupLibrary.findByShape(claim.shape);
    const out: QueuedQuestion[] = [];
    for (let i = 0; i < templates.length; i += 1) {
      const t = templates[i]!;
      out.push({
        id: this.deps.idGen() as string,
        libraryQuestionId: t.id,
        kind: 'follow_up',
        text: t.text,
        targetClauses: [...t.targetClauses],
        priority: clamp01(FOLLOWUP_INJECT_BASE_PRIORITY - i * 0.02),
        sourceClaimId: claim.id,
        shape: t.shape,
        pinned: false,
      });
    }
    return out;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
