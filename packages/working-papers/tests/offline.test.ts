// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  InMemoryPendingUpdateStore,
  NetworkMonitor,
  createNarrativeDoc,
  replayPendingUpdates,
} from '../src/index.js';

describe('offline pending-update queue', () => {
  it('queues updates while offline and replays on reconnect', async () => {
    const store = new InMemoryPendingUpdateStore();
    const wp = createNarrativeDoc({ clientID: 1 });

    wp.meta.set('a', 1);
    const u1 = Y.encodeStateAsUpdateV2(wp.doc);
    await store.enqueue({
      id: 'u1',
      workingPaperId: 'wp-1',
      update: u1,
      enqueuedAt: 1,
      attempts: 0,
    });

    wp.meta.set('b', 2);
    const u2 = Y.encodeStateAsUpdateV2(wp.doc);
    await store.enqueue({
      id: 'u2',
      workingPaperId: 'wp-1',
      update: u2,
      enqueuedAt: 2,
      attempts: 0,
    });

    expect(await store.size('wp-1')).toBe(2);

    const sent: Uint8Array[] = [];
    const result = await replayPendingUpdates(store, 'wp-1', async (u) => {
      sent.push(u);
    });
    expect(result.replayed).toBe(2);
    expect(result.failed).toHaveLength(0);
    expect(await store.size('wp-1')).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('failed sends remain in store with bumped attempts', async () => {
    const store = new InMemoryPendingUpdateStore();
    await store.enqueue({
      id: 'u1',
      workingPaperId: 'wp-1',
      update: new Uint8Array([1]),
      enqueuedAt: 1,
      attempts: 0,
    });
    const result = await replayPendingUpdates(store, 'wp-1', async () => {
      throw new Error('offline still');
    });
    expect(result.replayed).toBe(0);
    expect(result.failed[0]?.attempts).toBe(1);
    expect(await store.size('wp-1')).toBe(1);
  });
});

describe('NetworkMonitor', () => {
  it('flips state when probe transitions and emits to listeners', async () => {
    let online = true;
    const probe = { ping: vi.fn(async () => online) };
    const monitor = new NetworkMonitor({ probe, intervalMs: 10_000, initial: true });
    const events: boolean[] = [];
    monitor.on((s) => events.push(s));
    online = false;
    await monitor.tick();
    expect(monitor.isOnline()).toBe(false);
    expect(events).toEqual([false]);
    online = true;
    await monitor.tick();
    expect(events).toEqual([false, true]);
  });

  it('treats probe rejection as offline', async () => {
    const probe = {
      ping: async () => {
        throw new Error('boom');
      },
    };
    const monitor = new NetworkMonitor({ probe, initial: true });
    await monitor.tick();
    expect(monitor.isOnline()).toBe(false);
  });
});
