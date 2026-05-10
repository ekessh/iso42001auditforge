// SPDX-License-Identifier: BUSL-1.1
'use client';

import type * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';

export interface CreateSyncProviderOpts {
  workingPaperId: string;
  endpoint: string;
  doc: Y.Doc;
  awareness?: Awareness;
}

export interface SyncProvider {
  doc: Y.Doc;
  awareness: Awareness;
  websocket: WebsocketProvider;
  persistence: IndexeddbPersistence;
  destroy: () => void;
  whenSynced: Promise<void>;
}

/**
 * WHY: Centralised wiring keeps three concerns aligned:
 *  1. local IndexedDB keeps the doc available offline,
 *  2. y-websocket carries live updates + awareness,
 *  3. callers can swap awareness implementations in tests.
 */
export function createSyncProvider(opts: CreateSyncProviderOpts): SyncProvider {
  const persistence = new IndexeddbPersistence(`af-wp:${opts.workingPaperId}`, opts.doc);
  const awareness = opts.awareness ?? new Awareness(opts.doc);
  const websocket = new WebsocketProvider(opts.endpoint, opts.workingPaperId, opts.doc, {
    awareness,
    connect: true,
  });

  const whenSynced = new Promise<void>((resolve) => {
    let resolved = false;
    const fire = (): void => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    persistence.once('synced', fire);
    websocket.once('sync', fire);
  });

  return {
    doc: opts.doc,
    awareness,
    websocket,
    persistence,
    whenSynced,
    destroy: () => {
      try {
        websocket.destroy();
      } catch {
        /* swallow */
      }
      try {
        persistence.destroy();
      } catch {
        /* swallow */
      }
    },
  };
}
