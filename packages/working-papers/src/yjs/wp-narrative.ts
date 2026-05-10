// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';

export const NARRATIVE_SLOTS = Object.freeze({
  meta: 'meta',
  body: 'body',
  comments: 'comments',
} as const);

export interface NarrativeDoc {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  body: Y.XmlFragment;
  comments: Y.Array<Y.Map<unknown>>;
}

export function createNarrativeDoc(opts?: { clientID?: number }): NarrativeDoc {
  const doc = new Y.Doc();
  if (opts?.clientID !== undefined) doc.clientID = opts.clientID;
  return {
    doc,
    meta: doc.getMap(NARRATIVE_SLOTS.meta),
    body: doc.getXmlFragment(NARRATIVE_SLOTS.body),
    comments: doc.getArray<Y.Map<unknown>>(NARRATIVE_SLOTS.comments),
  };
}
