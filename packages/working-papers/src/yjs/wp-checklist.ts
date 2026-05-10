// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';

export const CHECKLIST_SLOTS = Object.freeze({
  meta: 'meta',
  items: 'items',
  decisions: 'decisions',
} as const);

export type ChecklistState = 'pass' | 'fail' | 'na' | 'pending';

export interface ChecklistDoc {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  items: Y.Array<Y.Map<unknown>>;
  decisions: Y.Map<unknown>;
}

export function createChecklistDoc(opts?: { clientID?: number }): ChecklistDoc {
  const doc = new Y.Doc();
  if (opts?.clientID !== undefined) doc.clientID = opts.clientID;
  return {
    doc,
    meta: doc.getMap(CHECKLIST_SLOTS.meta),
    items: doc.getArray<Y.Map<unknown>>(CHECKLIST_SLOTS.items),
    decisions: doc.getMap(CHECKLIST_SLOTS.decisions),
  };
}

export function readChecklistItemState(item: Y.Map<unknown>): ChecklistState {
  const v = item.get('state');
  if (v === 'pass' || v === 'fail' || v === 'na' || v === 'pending') return v;
  return 'pending';
}

export function setChecklistItemState(
  item: Y.Map<unknown>,
  state: ChecklistState,
  authorId: string,
): void {
  item.set('state', state);
  item.set('decidedBy', authorId);
  item.set('decidedAt', new Date().toISOString());
}
