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
import { CHECKLIST_SLOTS, readChecklistItemState } from './yjs/wp-checklist.js';
import type { ChecklistState } from './yjs/wp-checklist.js';

export interface ReconcileFieldDiff<T> {
  field: 'verdict' | 'confidence';
  local: T;
  remote: T;
  merged: T;
  conflict: boolean;
  suggestion: T;
}

export interface Reconcile {
  verdict: ReconcileFieldDiff<Verdict>;
  confidence: ReconcileFieldDiff<Confidence>;
  hasConflict: boolean;
}

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

export function clampVerdictByStateMachine(
  current: Verdict,
  candidate: Verdict,
): Verdict {
  if (current === candidate) return current;
  return isTransitionAllowed(current, candidate) ? candidate : current;
}

/* ------------------------------------------------------------------------- */
/* Soft (semantic) conflicts                                                  */
/* ------------------------------------------------------------------------- */

export interface SoftConflict {
  /** Stable id derived from `${kind}:${itemId}`. */
  id: string;
  kind: 'checklist-state';
  itemId: string;
  itemText: string;
  branches: SoftConflictBranch[];
}

export interface SoftConflictBranch {
  source: 'local' | 'remote';
  state: ChecklistState;
  decidedBy: string | undefined;
  decidedAt: string | undefined;
}

export type SoftConflictResolution =
  | { kind: 'pick'; source: 'local' | 'remote' }
  | { kind: 'override'; state: ChecklistState };

export interface ResolveConflictInput {
  workingPaperId: string;
  conflictId: string;
  resolution: SoftConflictResolution;
  doc: Y.Doc;
  authorId: string;
}

export interface ResolveConflictResult {
  workingPaperId: string;
  conflictId: string;
  appliedState: ChecklistState;
  appliedAt: string;
}

interface ChecklistItemSnapshot {
  id: string;
  text: string;
  state: ChecklistState;
  decidedBy: string | undefined;
  decidedAt: string | undefined;
}

function readChecklistItems(doc: Y.Doc): Map<string, ChecklistItemSnapshot> {
  const out = new Map<string, ChecklistItemSnapshot>();
  const arr = doc.getArray<Y.Map<unknown>>(CHECKLIST_SLOTS.items);
  arr.forEach((item) => {
    const id = (item.get('id') as string | undefined) ?? '';
    if (!id) return;
    out.set(id, {
      id,
      text: (item.get('text') as string | undefined) ?? '',
      state: readChecklistItemState(item),
      decidedBy: item.get('decidedBy') as string | undefined,
      decidedAt: item.get('decidedAt') as string | undefined,
    });
  });
  return out;
}

/**
 * WHY: Yjs picks one branch deterministically when two replicas both write
 * `state` on the same checklist item. That is fine for keystrokes but wrong
 * for verdict-shaped decisions — auditors must explicitly choose.
 */
export function detectSoftConflicts(
  localDoc: Y.Doc,
  remoteDoc: Y.Doc,
): SoftConflict[] {
  const local = readChecklistItems(localDoc);
  const remote = readChecklistItems(remoteDoc);
  const conflicts: SoftConflict[] = [];
  for (const [id, l] of local) {
    const r = remote.get(id);
    if (!r) continue;
    if (l.state === r.state) continue;
    if (l.state === 'pending' || r.state === 'pending') continue;
    conflicts.push({
      id: `checklist-state:${id}`,
      kind: 'checklist-state',
      itemId: id,
      itemText: l.text || r.text,
      branches: [
        { source: 'local', state: l.state, decidedBy: l.decidedBy, decidedAt: l.decidedAt },
        { source: 'remote', state: r.state, decidedBy: r.decidedBy, decidedAt: r.decidedAt },
      ],
    });
  }
  return conflicts;
}

export function resolveConflict(input: ResolveConflictInput): ResolveConflictResult {
  if (!input.conflictId.startsWith('checklist-state:')) {
    throw new Error(`Unsupported conflict kind: ${input.conflictId}`);
  }
  const itemId = input.conflictId.slice('checklist-state:'.length);
  const items = input.doc.getArray<Y.Map<unknown>>(CHECKLIST_SLOTS.items);
  let target: Y.Map<unknown> | null = null;
  items.forEach((m) => {
    if ((m.get('id') as string | undefined) === itemId) target = m;
  });
  if (!target) {
    throw new Error(`Checklist item ${itemId} not found in working paper ${input.workingPaperId}`);
  }
  let appliedState: ChecklistState;
  if (input.resolution.kind === 'pick') {
    appliedState = readChecklistItemState(target);
    if (input.resolution.source === 'remote') {
      // Already merged — the explicit re-set acts as the auditor's signature.
      appliedState = readChecklistItemState(target);
    }
  } else {
    appliedState = input.resolution.state;
  }
  const at = new Date().toISOString();
  input.doc.transact(() => {
    (target as unknown as Y.Map<unknown>).set('state', appliedState);
    (target as unknown as Y.Map<unknown>).set('decidedBy', input.authorId);
    (target as unknown as Y.Map<unknown>).set('decidedAt', at);
    (target as unknown as Y.Map<unknown>).set('resolvedConflictId', input.conflictId);
  }, { resolvedConflict: input.conflictId });
  return {
    workingPaperId: input.workingPaperId,
    conflictId: input.conflictId,
    appliedState,
    appliedAt: at,
  };
}
