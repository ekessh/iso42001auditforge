// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';
import {
  applySnapshotBytes,
  createWorkingPaperDoc,
  diffSinceStateVector,
  encodeSnapshotBytes,
  encodeStateVector,
} from './crdt.js';
import { snapshotFromDoc, type PersistedSnapshot } from './yjs/snapshot.js';

export interface OfflineSyncDelta {
  update: Uint8Array;
  size: number;
  empty: boolean;
}

export function computeDelta(
  doc: Y.Doc,
  peerStateVector: Uint8Array,
): OfflineSyncDelta {
  const update = diffSinceStateVector(doc, peerStateVector);
  const empty = isEmptyUpdate(update);
  return { update, size: update.byteLength, empty };
}

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

export function captureStateVector(doc: Y.Doc): Uint8Array {
  return encodeStateVector(doc);
}

function isEmptyUpdate(update: Uint8Array): boolean {
  return update.byteLength <= 4;
}

/* ------------------------------------------------------------------------- */
/* Server-side sync session                                                   */
/* ------------------------------------------------------------------------- */

export const SYNC_PROTOCOL_VERSION = 1;
export const WS_AUTH_REJECTED = 4401;
export const WS_FORBIDDEN = 4403;
export const WS_BAD_REQUEST = 4400;
export const WS_NOT_FOUND = 4404;

export interface AuthorizedAuditor {
  auditorId: string;
  firmId: string;
  engagementId: string;
  displayName: string;
}

export interface SyncEnvelope {
  v: typeof SYNC_PROTOCOL_VERSION;
  kind: 'sync' | 'awareness';
  payload: string;
}

/**
 * Decision returned by `decideAuth`. Implementations live in apps/api but the
 * shape is fixed here so the package can unit-test the authorization plumbing
 * without dragging in Nest.
 */
export type AuthDecision =
  | { allow: true; auditor: AuthorizedAuditor }
  | { allow: false; code: number; reason: string };

export interface SyncRoom {
  workingPaperId: string;
  firmId: string;
  engagementId: string;
}

export interface SyncCommitEvent {
  workingPaperId: string;
  firmId: string;
  engagementId: string;
  auditorId: string;
  contentHash: string;
  occurredAt: string;
}

/**
 * Debounce ledger emission. Yjs spits an update per keystroke; the audit
 * ledger should record one chain-linked event per ~5 s of activity per WP.
 */
export class CommitDebouncer {
  private readonly intervalMs: number;
  private readonly emit: (event: SyncCommitEvent) => Promise<void> | void;
  private readonly clock: () => number;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly pending = new Map<string, SyncCommitEvent>();

  constructor(opts: {
    intervalMs?: number;
    emit: (event: SyncCommitEvent) => Promise<void> | void;
    clock?: () => number;
  }) {
    this.intervalMs = opts.intervalMs ?? 5_000;
    this.emit = opts.emit;
    this.clock = opts.clock ?? Date.now;
  }

  schedule(event: SyncCommitEvent): void {
    const key = event.workingPaperId;
    this.pending.set(key, event);
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      const ev = this.pending.get(key);
      this.pending.delete(key);
      this.timers.delete(key);
      if (ev) void this.emit(ev);
    }, this.intervalMs);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref?.();
    this.timers.set(key, timer);
  }

  flush(workingPaperId: string): void {
    const ev = this.pending.get(workingPaperId);
    if (!ev) return;
    const t = this.timers.get(workingPaperId);
    if (t) clearTimeout(t);
    this.timers.delete(workingPaperId);
    this.pending.delete(workingPaperId);
    void this.emit(ev);
  }

  flushAll(): void {
    for (const id of [...this.pending.keys()]) this.flush(id);
  }

  /** For tests: synthesize a clock value. */
  now(): number {
    return this.clock();
  }
}

export interface RoomSnapshotLoader {
  load(roomId: string): Promise<Uint8Array | null>;
  persistSnapshot(
    roomId: string,
    snapshot: PersistedSnapshot,
    auditorId: string,
  ): Promise<void>;
  appendUpdate(
    roomId: string,
    update: Uint8Array,
    auditorId: string,
  ): Promise<void>;
}

/**
 * Per-room state held on the server. Many sockets may attach to the same
 * room — broadcast ordering is FIFO across all subscribers.
 */
export class SyncRoomState {
  readonly doc: Y.Doc;
  private readonly subscribers = new Set<(update: Uint8Array, origin: unknown) => void>();

  constructor(initial?: Uint8Array | null) {
    this.doc = new Y.Doc();
    if (initial && initial.byteLength > 0) Y.applyUpdateV2(this.doc, initial);
  }

  applyClientUpdate(update: Uint8Array, origin: unknown): void {
    Y.applyUpdateV2(this.doc, update, origin);
  }

  subscribe(listener: (update: Uint8Array, origin: unknown) => void): () => void {
    this.subscribers.add(listener);
    const handler = (update: Uint8Array, origin: unknown): void => listener(update, origin);
    this.doc.on('updateV2', handler);
    return () => {
      this.subscribers.delete(listener);
      this.doc.off('updateV2', handler);
    };
  }

  serializeSnapshot(): PersistedSnapshot {
    return snapshotFromDoc(this.doc);
  }

  /** Number of distinct subscribers currently attached. */
  size(): number {
    return this.subscribers.size;
  }
}
