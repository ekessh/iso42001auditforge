// SPDX-License-Identifier: BUSL-1.1
'use client';

import type {
  PendingUpdate,
  PendingUpdateStore,
} from '@auditforge/working-papers';

const DB_VERSION = 1;
const STORE = 'pending-updates';

function dbName(workingPaperId: string): string {
  return `af-wp-pending:${workingPaperId}`;
}

function open(workingPaperId: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName(workingPaperId), DB_VERSION);
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void => reject(req.error);
  });
}

/**
 * IndexedDB-backed pending-update queue. WHY a separate DB per WP: lets us
 * fast-path "drop everything for this WP" on unbind without paying a cursor
 * scan, and bounds the per-document growth.
 */
export class IndexedDbPendingUpdateStore implements PendingUpdateStore {
  async enqueue(update: PendingUpdate): Promise<void> {
    const db = await open(update.workingPaperId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.put(update);
      req.onsuccess = (): void => resolve();
      req.onerror = (): void => reject(req.error);
    });
    db.close();
  }

  async list(workingPaperId: string): Promise<PendingUpdate[]> {
    const db = await open(workingPaperId);
    const items = await new Promise<PendingUpdate[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = (): void => resolve((req.result as PendingUpdate[]).sort((a, b) => a.enqueuedAt - b.enqueuedAt));
      req.onerror = (): void => reject(req.error);
    });
    db.close();
    return items;
  }

  async delete(id: string): Promise<void> {
    // We cannot know which WP this id belongs to without listing — caller
    // should use deleteFor or clear instead. As a fallback, scan all known
    // databases is impractical; we no-op here.
    void id;
  }

  async deleteFor(workingPaperId: string, id: string): Promise<void> {
    const db = await open(workingPaperId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.delete(id);
      req.onsuccess = (): void => resolve();
      req.onerror = (): void => reject(req.error);
    });
    db.close();
  }

  async clear(workingPaperId: string): Promise<void> {
    const db = await open(workingPaperId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.clear();
      req.onsuccess = (): void => resolve();
      req.onerror = (): void => reject(req.error);
    });
    db.close();
  }

  async size(workingPaperId: string): Promise<number> {
    const db = await open(workingPaperId);
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.count();
      req.onsuccess = (): void => resolve(req.result);
      req.onerror = (): void => reject(req.error);
    });
    db.close();
    return count;
  }
}
