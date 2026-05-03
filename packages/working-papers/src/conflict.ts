// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';
import {
  applySnapshotBytes,
  createWorkingPaperDoc,
  encodeSnapshotBytes,
  readConfidence,
  readVerdict,
} from './crdt.js';
import { isTransitionAllowed } from './verdict.js';
import type { Confidence, Verdict } from './domain.js';

/**
 * Non-mergeable fields cannot be reconciled by Yjs alone — two replicas may
 * concurrently write `verdict` and the CRDT will pick one arbitrarily. The
 * conflict reconciler detects these cases and surfaces a structured Reconcile
 * artifact for the UI to present a "pick one" prompt.
 */
export interface ReconcileFieldDiff<T> {
  field: 'verdict' | 'confidence';
  local: T;
  remote: T;
  merged: T;
  /** True when the local and remote values were genuinely different. */
  conflict: boolean;
  /**
   * Suggested resolution. For verdicts, "tighter" wins (e.g. major_nc beats
   * conformant). For confidence, the lower (more pessimistic) wins. The UI
   * may override; this is only a hint.
   */
  suggestion: T;
}

export interface Reconcile {
  verdict: ReconcileFieldDiff<Verdict>;
  confidence: ReconcileFieldDiff<Confidence>;
  hasConflict: boolean;
}

/**
 * Severity ordering used when suggesting a resolution. Higher = stricter.
 */
const VERDICT_SEVERITY: Record<Verdict, number> = {
  na: 0,
  conformant: 1,
  ofi: 2,
  minor_nc: 3,
  major_nc: 4,
};

function suggestVerdict(a: Verdict, b: Verdict): Verdict {
  if (VERDICT_SEVERITY[a] >= VERDICT_SEVERITY[b]) return a;
  return b;
}

/**
 * Reconcile two snapshots of the same working paper. The function does NOT
 * mutate either input; it merges into a fresh doc and returns the encoded
 * merge plus a `Reconcile` describing any non-mergeable conflicts.
 *
 * Inputs are encoded Yjs updates as raw bytes (use `encodeSnapshotBytes`).
 */
export function reconcileSnapshots(
  local: Uint8Array,
  remote: Uint8Array,
): { merged: Uint8Array; reconcile: Reconcile } {
  const localDoc = createWorkingPaperDoc({ clientID: 0xa11ce });
  applySnapshotBytes(localDoc.doc, local);
  const remoteDoc = createWorkingPaperDoc({ clientID: 0xb0b });
  applySnapshotBytes(remoteDoc.doc, remote);

  const localVerdict = readVerdict(localDoc.meta);
  const remoteVerdict = readVerdict(remoteDoc.meta);
  const localConfidence = readConfidence(localDoc.meta);
  const remoteConfidence = readConfidence(remoteDoc.meta);

  // Merge by applying both updates into a fresh doc. Yjs handles the mergeable
  // parts; the meta map's verdict/confidence will end up at one peer's value
  // (last writer wins by lamport clock). We do NOT trust that for the UI.
  const merged = createWorkingPaperDoc({ clientID: 0xc0ffee });
  Y.applyUpdateV2(merged.doc, local);
  Y.applyUpdateV2(merged.doc, remote);

  const mergedVerdict = readVerdict(merged.meta);
  const mergedConfidence = readConfidence(merged.meta);

  const verdictConflict = localVerdict !== remoteVerdict;
  const confidenceConflict = localConfidence !== remoteConfidence;

  const verdictDiff: ReconcileFieldDiff<Verdict> = {
    field: 'verdict',
    local: localVerdict,
    remote: remoteVerdict,
    merged: mergedVerdict,
    conflict: verdictConflict,
    suggestion: verdictConflict
      ? suggestVerdict(localVerdict, remoteVerdict)
      : localVerdict,
  };

  const confidenceDiff: ReconcileFieldDiff<Confidence> = {
    field: 'confidence',
    local: localConfidence,
    remote: remoteConfidence,
    merged: mergedConfidence,
    conflict: confidenceConflict,
    // suggestion: more pessimistic (lower) wins.
    suggestion: confidenceConflict
      ? ((Math.min(localConfidence, remoteConfidence) as unknown) as Confidence)
      : localConfidence,
  };

  return {
    merged: encodeSnapshotBytes(merged.doc),
    reconcile: {
      verdict: verdictDiff,
      confidence: confidenceDiff,
      hasConflict: verdictConflict || confidenceConflict,
    },
  };
}

/**
 * Reject a reconciliation suggestion that would yield an illegal verdict
 * transition. The current persisted verdict is `current`; the candidate is
 * `candidate`. Returns `current` if the transition is illegal.
 *
 * Useful when the auditor accepted a reconcile suggestion but the WP's
 * persisted verdict has since moved.
 */
export function clampVerdictByStateMachine(
  current: Verdict,
  candidate: Verdict,
): Verdict {
  if (current === candidate) return current;
  return isTransitionAllowed(current, candidate) ? candidate : current;
}
