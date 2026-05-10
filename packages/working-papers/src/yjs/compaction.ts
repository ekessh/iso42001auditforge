// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';
import { applyUpdates, snapshotFromDoc, type PersistedSnapshot } from './snapshot.js';

export interface CompactionInput {
  baseSnapshot: Uint8Array | null;
  updates: readonly Uint8Array[];
}

export interface CompactionResult {
  snapshot: PersistedSnapshot;
  mergedUpdateCount: number;
}

/**
 * Merge the incremental update log on top of the previous snapshot, producing
 * a new snapshot ready to replace both. The caller (BullMQ worker) is
 * responsible for pruning the merged updates inside the same transaction so a
 * crash mid-compaction never loses durability.
 */
export function compact(input: CompactionInput): CompactionResult {
  const doc = new Y.Doc();
  if (input.baseSnapshot) Y.applyUpdateV2(doc, input.baseSnapshot);
  applyUpdates(doc, input.updates);
  return {
    snapshot: snapshotFromDoc(doc),
    mergedUpdateCount: input.updates.length,
  };
}

export const DEFAULT_COMPACTION_INTERVAL_MS = 60_000;
export const COMPACTION_QUEUE_NAME = 'wp-compaction';
export interface CompactionJobData {
  workingPaperId: string;
  firmId: string;
  engagementId: string;
}
