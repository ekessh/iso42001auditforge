// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';

export const EVIDENCE_LIST_SLOTS = Object.freeze({
  meta: 'meta',
  entries: 'entries',
} as const);

export interface EvidenceListDoc {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  entries: Y.Array<Y.Map<unknown>>;
}

export function createEvidenceListDoc(opts?: {
  clientID?: number;
}): EvidenceListDoc {
  const doc = new Y.Doc();
  if (opts?.clientID !== undefined) doc.clientID = opts.clientID;
  return {
    doc,
    meta: doc.getMap(EVIDENCE_LIST_SLOTS.meta),
    entries: doc.getArray<Y.Map<unknown>>(EVIDENCE_LIST_SLOTS.entries),
  };
}
