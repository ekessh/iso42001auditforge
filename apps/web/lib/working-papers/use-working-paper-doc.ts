// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import {
  colorForAuditor,
  listPeers,
  setLocalPresence,
  type PresenceState,
} from '@auditforge/working-papers';
import { createSyncProvider, type SyncProvider } from '@/lib/sync/provider';

export interface UseWorkingPaperDocOpts {
  workingPaperId: string;
  endpoint: string;
  user: { auditorId: string; displayName: string };
}

export interface UseWorkingPaperDocResult {
  doc: Y.Doc | null;
  awareness: Awareness | null;
  isReady: boolean;
  peers: PresenceState[];
  pendingCount: number;
  error: Error | null;
}

/**
 * Hook returning the live Y.Doc + awareness. Ref-counts a shared provider per
 * WP id so two components on the same page do not double-connect.
 */
export function useWorkingPaperDoc(
  opts: UseWorkingPaperDocOpts,
): UseWorkingPaperDocResult {
  const [provider, setProvider] = React.useState<SyncProvider | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [peers, setPeers] = React.useState<PresenceState[]>([]);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const doc = new Y.Doc();
    const p = createSyncProvider({
      workingPaperId: opts.workingPaperId,
      endpoint: opts.endpoint,
      doc,
    });
    setProvider(p);
    p.whenSynced
      .then(() => {
        setIsReady(true);
        setLocalPresence(p.awareness, {
          user: {
            auditorId: opts.user.auditorId,
            displayName: opts.user.displayName,
            color: colorForAuditor(opts.user.auditorId),
          },
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });

    const onPresence = (): void => {
      setPeers(listPeers(p.awareness));
    };
    p.awareness.on('change', onPresence);

    const onPending = (): void => {
      setPendingCount((c) => c + 1);
    };
    const onSent = (): void => {
      setPendingCount((c) => Math.max(0, c - 1));
    };
    p.websocket.on('status', (e: { status: string }) => {
      if (e.status === 'connected') setPendingCount(0);
    });
    p.doc.on('update', onPending);
    p.websocket.on('sync', onSent);

    return () => {
      p.awareness.off('change', onPresence);
      p.doc.off('update', onPending);
      p.destroy();
    };
  }, [opts.workingPaperId, opts.endpoint, opts.user.auditorId, opts.user.displayName]);

  return {
    doc: provider?.doc ?? null,
    awareness: provider?.awareness ?? null,
    isReady,
    peers,
    pendingCount,
    error,
  };
}
