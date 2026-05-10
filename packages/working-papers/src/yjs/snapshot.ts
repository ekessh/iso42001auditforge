// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';
import { createHash } from 'node:crypto';

export interface PersistedSnapshot {
  bytes: Uint8Array;
  contentHash: string;
  capturedAt: string;
}

export function serialize(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc);
}

export function deserialize(bytes: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdateV2(doc, bytes);
  return doc;
}

export function snapshotFromDoc(doc: Y.Doc): PersistedSnapshot {
  const bytes = serialize(doc);
  const hash = createHash('sha256').update(bytes).digest('hex');
  return { bytes, contentHash: hash, capturedAt: new Date().toISOString() };
}

export function applyUpdates(doc: Y.Doc, updates: Iterable<Uint8Array>): void {
  for (const update of updates) {
    Y.applyUpdateV2(doc, update);
  }
}

/**
 * WHY: Server uses this when the connecting client sends its state vector so we
 * can return only the missing operations rather than a full snapshot.
 */
export function diffFor(doc: Y.Doc, peerStateVector: Uint8Array): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc, peerStateVector);
}

export function stateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}
