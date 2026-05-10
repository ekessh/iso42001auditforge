// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  CommitDebouncer,
  SyncRoomState,
  applyOfflineRoundtrip,
  computeDelta,
  createNarrativeDoc,
  captureStateVector,
} from '../src/index.js';

describe('CommitDebouncer', () => {
  it('coalesces rapid updates into one ledger emission', async () => {
    vi.useFakeTimers();
    const emitted: string[] = [];
    const d = new CommitDebouncer({
      intervalMs: 5_000,
      emit: (e) => {
        emitted.push(e.contentHash);
      },
    });
    const base = {
      workingPaperId: 'wp-1',
      firmId: 'firm-1',
      engagementId: 'eng-1',
      auditorId: 'a-1',
      occurredAt: '2026-05-10T00:00:00Z',
    };
    d.schedule({ ...base, contentHash: 'h1' });
    d.schedule({ ...base, contentHash: 'h2' });
    d.schedule({ ...base, contentHash: 'h3' });
    expect(emitted).toEqual([]);
    await vi.advanceTimersByTimeAsync(5_500);
    expect(emitted).toEqual(['h3']);
    vi.useRealTimers();
  });

  it('flushAll emits pending entries immediately', async () => {
    vi.useFakeTimers();
    const emitted: string[] = [];
    const d = new CommitDebouncer({
      intervalMs: 5_000,
      emit: (e) => {
        emitted.push(e.workingPaperId);
      },
    });
    d.schedule({
      workingPaperId: 'wp-1',
      firmId: 'f',
      engagementId: 'e',
      auditorId: 'a',
      contentHash: 'h',
      occurredAt: '2026-05-10T00:00:00Z',
    });
    d.flushAll();
    await vi.runAllTimersAsync();
    expect(emitted).toEqual(['wp-1']);
    vi.useRealTimers();
  });
});

describe('SyncRoomState', () => {
  it('broadcasts updates to subscribers', () => {
    const room = new SyncRoomState();
    const observed: Uint8Array[] = [];
    const stop = room.subscribe((u) => observed.push(u));

    const A = createNarrativeDoc({ clientID: 9 });
    A.meta.set('k', 'v');
    const update = Y.encodeStateAsUpdateV2(A.doc);
    room.applyClientUpdate(update, 'client-A');

    expect(observed.length).toBeGreaterThan(0);
    stop();
  });

  it('serializeSnapshot returns sha256-tagged bytes', () => {
    const room = new SyncRoomState();
    const A = createNarrativeDoc({ clientID: 9 });
    A.meta.set('k', 'v');
    room.applyClientUpdate(Y.encodeStateAsUpdateV2(A.doc), 'client-A');
    const snap = room.serializeSnapshot();
    expect(snap.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.bytes.byteLength).toBeGreaterThan(0);
  });
});

describe('offline roundtrip', () => {
  it('applies client edits to server snapshot and returns delta', () => {
    const server = createNarrativeDoc({ clientID: 1 });
    server.meta.set('a', 1);
    const serverSnap = Y.encodeStateAsUpdateV2(server.doc);

    const client = createNarrativeDoc({ clientID: 2 });
    Y.applyUpdateV2(client.doc, serverSnap);
    client.meta.set('b', 2);
    const clientUpdate = Y.encodeStateAsUpdateV2(client.doc, captureStateVector(server.doc));

    const result = applyOfflineRoundtrip(
      serverSnap,
      Y.encodeStateVector(client.doc),
      clientUpdate,
    );

    const replayed = new Y.Doc();
    Y.applyUpdateV2(replayed, result.mergedSnapshot);
    expect(replayed.getMap('meta').get('a')).toBe(1);
    expect(replayed.getMap('meta').get('b')).toBe(2);
    expect(result.serverDelta.size).toBeGreaterThanOrEqual(0);
  });

  it('computeDelta on a doc that has changes returns a non-zero delta', () => {
    const A = createNarrativeDoc({ clientID: 1 });
    const baselineSv = Y.encodeStateVector(A.doc);
    A.meta.set('a', 1);
    const delta = computeDelta(A.doc, baselineSv);
    expect(delta.size).toBeGreaterThan(0);
    expect(delta.empty).toBe(false);
  });
});
