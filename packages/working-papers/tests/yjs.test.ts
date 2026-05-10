// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  createNarrativeDoc,
  createChecklistDoc,
  createEvidenceListDoc,
  createFindingDraftDoc,
  createInterviewNotesDoc,
  setChecklistItemState,
  readChecklistItemState,
  serialize,
  deserialize,
  snapshotFromDoc,
  compact,
  createAwareness,
  setLocalPresence,
  listPeers,
  colorForAuditor,
} from '../src/index.js';

describe('Y.Doc factories', () => {
  it('narrative doc exposes meta + body XmlFragment', () => {
    const wp = createNarrativeDoc({ clientID: 1 });
    wp.meta.set('title', 'Clause 7.4 narrative');
    expect(wp.body).toBeInstanceOf(Y.XmlFragment);
    expect(wp.meta.get('title')).toBe('Clause 7.4 narrative');
  });

  it('checklist item state defaults to pending and round-trips', () => {
    const wp = createChecklistDoc({ clientID: 1 });
    const item = new Y.Map<unknown>();
    item.set('id', 'q-1');
    item.set('text', 'Has the AI policy been published?');
    wp.items.push([item]);
    expect(readChecklistItemState(item)).toBe('pending');
    setChecklistItemState(item, 'pass', 'auditor-1');
    expect(readChecklistItemState(item)).toBe('pass');
    expect(item.get('decidedBy')).toBe('auditor-1');
  });

  it('evidence list / finding draft / interview notes all return Y types', () => {
    const ev = createEvidenceListDoc();
    const fd = createFindingDraftDoc();
    const ix = createInterviewNotesDoc();
    expect(ev.entries).toBeInstanceOf(Y.Array);
    expect(fd.statement).toBeInstanceOf(Y.XmlFragment);
    expect(ix.transcript).toBeInstanceOf(Y.XmlFragment);
    expect(ix.questions).toBeInstanceOf(Y.Array);
  });
});

describe('snapshot ser/de + compaction', () => {
  it('serialize+deserialize is round-trip stable', () => {
    const wp = createNarrativeDoc({ clientID: 7 });
    wp.meta.set('a', 1);
    wp.meta.set('b', 'two');
    const bytes = serialize(wp.doc);
    const round = deserialize(bytes);
    expect(round.getMap('meta').get('a')).toBe(1);
    expect(round.getMap('meta').get('b')).toBe('two');
  });

  it('snapshotFromDoc emits a sha256 hex hash', () => {
    const wp = createNarrativeDoc({ clientID: 7 });
    wp.meta.set('x', 'y');
    const snap = snapshotFromDoc(wp.doc);
    expect(snap.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('compact merges base snapshot + update log into one snapshot', () => {
    const a = createNarrativeDoc({ clientID: 1 });
    a.meta.set('first', 1);
    const base = serialize(a.doc);

    const b = createNarrativeDoc({ clientID: 2 });
    Y.applyUpdateV2(b.doc, base);
    b.meta.set('second', 2);
    const u1 = Y.encodeStateAsUpdateV2(b.doc, Y.encodeStateVector(a.doc));

    const result = compact({ baseSnapshot: base, updates: [u1] });
    const merged = deserialize(result.snapshot.bytes);
    expect(merged.getMap('meta').get('first')).toBe(1);
    expect(merged.getMap('meta').get('second')).toBe(2);
    expect(result.mergedUpdateCount).toBe(1);
  });
});

describe('Yjs concurrent merges (deterministic outcome)', () => {
  it('two clients editing same doc converge after exchange', () => {
    const A = createNarrativeDoc({ clientID: 1 });
    const B = createNarrativeDoc({ clientID: 2 });

    A.meta.set('verdict', 'conformant');
    B.meta.set('confidence', 75);

    const aUpdate = serialize(A.doc);
    const bUpdate = serialize(B.doc);

    Y.applyUpdateV2(A.doc, bUpdate);
    Y.applyUpdateV2(B.doc, aUpdate);

    expect(A.meta.get('verdict')).toBe('conformant');
    expect(A.meta.get('confidence')).toBe(75);
    expect(B.meta.get('verdict')).toBe('conformant');
    expect(B.meta.get('confidence')).toBe(75);
  });
});

describe('awareness presence', () => {
  it('peer count updates on remote presence write', () => {
    const A = createNarrativeDoc({ clientID: 100 });
    const B = createNarrativeDoc({ clientID: 200 });

    const awA = createAwareness(A.doc);
    const awB = createAwareness(B.doc);

    setLocalPresence(awA, {
      user: { auditorId: 'a', displayName: 'Alice', color: colorForAuditor('a') },
    });
    setLocalPresence(awB, {
      user: { auditorId: 'b', displayName: 'Bob', color: colorForAuditor('b') },
    });

    // Awareness state is shared via the wire protocol; for the unit test we
    // copy state across explicitly.
    awA.states.set(awB.clientID, awB.getLocalState() as Record<string, unknown>);

    const peers = listPeers(awA);
    expect(peers).toHaveLength(1);
    expect(peers[0]?.user.displayName).toBe('Bob');
  });

  it('colorForAuditor is deterministic and within palette', () => {
    expect(colorForAuditor('auditor-1')).toBe(colorForAuditor('auditor-1'));
    const c = colorForAuditor('auditor-1');
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
