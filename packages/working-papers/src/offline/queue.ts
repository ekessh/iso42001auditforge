// SPDX-License-Identifier: BUSL-1.1

export interface PendingUpdate {
  /** Stable monotonically-increasing id; used to dedupe replays. */
  id: string;
  workingPaperId: string;
  /** Yjs update bytes (v2 encoding). */
  update: Uint8Array;
  enqueuedAt: number;
  /** Number of replay attempts since enqueue. */
  attempts: number;
}

/**
 * Adapter abstraction so the queue itself is environment-neutral. Browsers use
 * IndexedDB; Node tests use an in-memory backend.
 */
export interface PendingUpdateStore {
  enqueue(update: PendingUpdate): Promise<void>;
  list(workingPaperId: string): Promise<PendingUpdate[]>;
  delete(id: string): Promise<void>;
  clear(workingPaperId: string): Promise<void>;
  size(workingPaperId: string): Promise<number>;
}

export class InMemoryPendingUpdateStore implements PendingUpdateStore {
  private readonly buckets = new Map<string, Map<string, PendingUpdate>>();

  async enqueue(update: PendingUpdate): Promise<void> {
    const bucket = this.buckets.get(update.workingPaperId) ?? new Map<string, PendingUpdate>();
    bucket.set(update.id, update);
    this.buckets.set(update.workingPaperId, bucket);
  }

  async list(workingPaperId: string): Promise<PendingUpdate[]> {
    return [...(this.buckets.get(workingPaperId)?.values() ?? [])].sort(
      (a, b) => a.enqueuedAt - b.enqueuedAt,
    );
  }

  async delete(id: string): Promise<void> {
    for (const bucket of this.buckets.values()) {
      if (bucket.delete(id)) return;
    }
  }

  async clear(workingPaperId: string): Promise<void> {
    this.buckets.delete(workingPaperId);
  }

  async size(workingPaperId: string): Promise<number> {
    return this.buckets.get(workingPaperId)?.size ?? 0;
  }
}

export interface ReplayResult {
  replayed: number;
  failed: PendingUpdate[];
}

export async function replayPendingUpdates(
  store: PendingUpdateStore,
  workingPaperId: string,
  send: (update: Uint8Array) => Promise<void>,
): Promise<ReplayResult> {
  const items = await store.list(workingPaperId);
  let replayed = 0;
  const failed: PendingUpdate[] = [];
  for (const item of items) {
    try {
      await send(item.update);
      await store.delete(item.id);
      replayed += 1;
    } catch {
      failed.push({ ...item, attempts: item.attempts + 1 });
    }
  }
  return { replayed, failed };
}
