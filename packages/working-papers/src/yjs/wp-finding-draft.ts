// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';

export const FINDING_DRAFT_SLOTS = Object.freeze({
  meta: 'meta',
  statement: 'statement',
  evidence: 'evidence',
  rationale: 'rationale',
  proposedClassification: 'proposedClassification',
} as const);

export interface FindingDraftDoc {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  statement: Y.XmlFragment;
  evidence: Y.Array<Y.Map<unknown>>;
  rationale: Y.XmlFragment;
  proposedClassification: Y.Map<unknown>;
}

export function createFindingDraftDoc(opts?: {
  clientID?: number;
}): FindingDraftDoc {
  const doc = new Y.Doc();
  if (opts?.clientID !== undefined) doc.clientID = opts.clientID;
  return {
    doc,
    meta: doc.getMap(FINDING_DRAFT_SLOTS.meta),
    statement: doc.getXmlFragment(FINDING_DRAFT_SLOTS.statement),
    evidence: doc.getArray<Y.Map<unknown>>(FINDING_DRAFT_SLOTS.evidence),
    rationale: doc.getXmlFragment(FINDING_DRAFT_SLOTS.rationale),
    proposedClassification: doc.getMap(FINDING_DRAFT_SLOTS.proposedClassification),
  };
}
