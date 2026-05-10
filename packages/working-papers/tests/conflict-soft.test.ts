// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createChecklistDoc,
  detectSoftConflicts,
  resolveConflict,
  setChecklistItemState,
} from '../src/index.js';

function checklistItem(id: string, text: string): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set('id', id);
  m.set('text', text);
  m.set('state', 'pending');
  return m;
}

describe('soft semantic conflict detection', () => {
  it('flags a checklist item set to PASS on one device and FAIL on another', () => {
    const A = createChecklistDoc({ clientID: 1 });
    const B = createChecklistDoc({ clientID: 2 });

    A.items.push([checklistItem('c-1', 'Is the AI inventory current?')]);
    const seed = Y.encodeStateAsUpdateV2(A.doc);
    Y.applyUpdateV2(B.doc, seed);

    const aItem = A.items.get(0);
    const bItem = B.items.get(0);
    setChecklistItemState(aItem, 'pass', 'alice');
    setChecklistItemState(bItem, 'fail', 'bob');

    const conflicts = detectSoftConflicts(A.doc, B.doc);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('checklist-state');
    expect(conflicts[0]?.itemId).toBe('c-1');
    expect(conflicts[0]?.branches.map((b) => b.state).sort()).toEqual(['fail', 'pass']);
  });

  it('does not flag matching states', () => {
    const A = createChecklistDoc({ clientID: 1 });
    const B = createChecklistDoc({ clientID: 2 });
    A.items.push([checklistItem('c-1', 'x')]);
    const seed = Y.encodeStateAsUpdateV2(A.doc);
    Y.applyUpdateV2(B.doc, seed);
    setChecklistItemState(A.items.get(0), 'pass', 'alice');
    setChecklistItemState(B.items.get(0), 'pass', 'bob');
    expect(detectSoftConflicts(A.doc, B.doc)).toHaveLength(0);
  });

  it('resolveConflict applies the chosen state and stamps decidedBy', () => {
    const A = createChecklistDoc({ clientID: 1 });
    A.items.push([checklistItem('c-1', 'x')]);
    setChecklistItemState(A.items.get(0), 'pass', 'alice');

    const result = resolveConflict({
      workingPaperId: 'wp-1',
      conflictId: 'checklist-state:c-1',
      resolution: { kind: 'override', state: 'fail' },
      doc: A.doc,
      authorId: 'lead-auditor',
    });
    expect(result.appliedState).toBe('fail');
    expect(A.items.get(0).get('decidedBy')).toBe('lead-auditor');
    expect(A.items.get(0).get('resolvedConflictId')).toBe('checklist-state:c-1');
  });
});
