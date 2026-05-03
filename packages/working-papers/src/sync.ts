// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';
import {
  applySnapshotBytes,
  createWorkingPaperDoc,
  diffSinceStateVector,
  encodeSnapshotBytes,
  encodeStateVector,
} from './crdt.js';

/**
 * OfflineSyncDelta — what an offline client computes on reconnect to sync
 * back to the server, and what the server returns to bring the client up to
 * speed.
 */
export interface OfflineSyncDelta {
  /** Update bytes to send to the peer (client->server or server->client). */
  update: Uint8Array;
  /** Number of bytes — used for telemetry / size budgets. */
  size: number;
  /** True when there were no new changes since `peerStateVector`. */
  empty: boolean;
}

/**
 * Compute the delta from a peer's known state vector to the current doc state.
 * Used by both directions: server gets `clientStateVector`, returns the delta
 * the client missed; client uses the same function to send pending edits.
 */
export function computeDelta(
  doc: Y.Doc,
  peerStateVector: Uint8Array,
): OfflineSyncDelta {
  const update = diffSinceStateVector(doc, peerStateVector);
  // An "empty" Y.js v2 update for an in-sync state-vector typically encodes a
  // small structural prologue with no actual operations. We bound by a tiny
  // threshold to flag emptiness.
  const empty = isEmptyUpdate(update);
  return { update, size: update.byteLength, empty };
}

/**
 * Bidirectional sync: from `localStateVector`, compute server->client delta;
 * from server's view of the current state, accept `clientUpdate` and apply it.
 *
 * Returns:
 *  - `serverDelta`     — bytes for client to apply to catch up
 *  - `mergedSnapshot`  — full server doc state after applying client update
 */
export function applyOfflineRoundtrip(
  serverSnapshot: Uint8Array,
  clientStateVector: Uint8Array,
  clientUpdate: Uint8Array,
): {
  serverDelta: OfflineSyncDelta;
  mergedSnapshot: Uint8Array;
} {
  const wp = createWorkingPaperDoc({ clientID: 1 });
  applySnapshotBytes(wp.doc, serverSnapshot);
  const serverDelta = computeDelta(wp.doc, clientStateVector);
  Y.applyUpdateV2(wp.doc, clientUpdate);
  return {
    serverDelta,
    mergedSnapshot: encodeSnapshotBytes(wp.doc),
  };
}

/**
 * Capture the current state vector — what the client persists to disk so the
 * server can compute a delta on reconnect.
 */
export function captureStateVector(doc: Y.Doc): Uint8Array {
  return encodeStateVector(doc);
}

/**
 * A "no-op" update from `Y.encodeStateAsUpdateV2(doc, sv)` where `sv` already
 * equals the doc's clock is short and lacks any structs. We treat anything
 * <= 4 bytes as empty (Y.js prepends a small versioned envelope).
 */
function isEmptyUpdate(update: Uint8Array): boolean {
  return update.byteLength <= 4;
}
