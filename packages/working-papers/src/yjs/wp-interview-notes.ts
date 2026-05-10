// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';

export const INTERVIEW_NOTES_SLOTS = Object.freeze({
  meta: 'meta',
  transcript: 'transcript',
  questions: 'questions',
  attributions: 'attributions',
} as const);

export interface InterviewNotesDoc {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  transcript: Y.XmlFragment;
  questions: Y.Array<Y.Map<unknown>>;
  attributions: Y.Array<Y.Map<unknown>>;
}

export function createInterviewNotesDoc(opts?: {
  clientID?: number;
}): InterviewNotesDoc {
  const doc = new Y.Doc();
  if (opts?.clientID !== undefined) doc.clientID = opts.clientID;
  return {
    doc,
    meta: doc.getMap(INTERVIEW_NOTES_SLOTS.meta),
    transcript: doc.getXmlFragment(INTERVIEW_NOTES_SLOTS.transcript),
    questions: doc.getArray<Y.Map<unknown>>(INTERVIEW_NOTES_SLOTS.questions),
    attributions: doc.getArray<Y.Map<unknown>>(INTERVIEW_NOTES_SLOTS.attributions),
  };
}
