// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { createBrowserNetworkMonitor } from '@/lib/sync/network';

export interface NetworkStatusValue {
  isOnline: boolean;
  lastSyncAt: number | null;
  pendingUpdateCount: number;
}

export function useNetworkStatus(opts?: {
  url?: string;
  intervalMs?: number;
  pendingUpdateCount?: number;
  lastSyncAt?: number | null;
}): NetworkStatusValue {
  const [isOnline, setIsOnline] = React.useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const monitor = createBrowserNetworkMonitor({
      ...(opts?.url ? { url: opts.url } : {}),
      ...(opts?.intervalMs ? { intervalMs: opts.intervalMs } : {}),
    });
    const off = monitor.on(setIsOnline);
    monitor.start();
    const handleOnline = (): void => {
      void monitor.tick();
    };
    const handleOffline = (): void => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      off();
      monitor.stop();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [opts?.url, opts?.intervalMs]);

  return {
    isOnline,
    lastSyncAt: opts?.lastSyncAt ?? null,
    pendingUpdateCount: opts?.pendingUpdateCount ?? 0,
  };
}
