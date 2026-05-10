// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { CloudOff } from 'lucide-react';

export interface OfflineBannerProps {
  isOnline: boolean;
  pendingUpdateCount: number;
  lastSyncAt?: number | null;
}

export function OfflineBanner({
  isOnline,
  pendingUpdateCount,
  lastSyncAt,
}: OfflineBannerProps) {
  if (isOnline && pendingUpdateCount === 0) return null;
  const lastSyncText = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString()
    : 'never';
  const message = isOnline
    ? `Reconnecting · ${pendingUpdateCount} update${pendingUpdateCount === 1 ? '' : 's'} pending sync.`
    : `Working offline. ${pendingUpdateCount} update${pendingUpdateCount === 1 ? '' : 's'} queued. Last sync ${lastSyncText}.`;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <CloudOff aria-hidden className="size-4" />
      <span>{message}</span>
    </div>
  );
}
