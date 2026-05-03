// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';

export interface OfflineStatus {
  online: boolean;
  /** Time since last transition. */
  since: Date;
  /** Manual override for testing. */
  override: (online: boolean | null) => void;
}

export function useOfflineStatus(): OfflineStatus {
  const [online, setOnline] = React.useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [since, setSince] = React.useState(() => new Date());
  const overrideRef = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    const handle = (next: boolean) => () => {
      if (overrideRef.current !== null) return;
      setOnline(next);
      setSince(new Date());
    };
    const onOnline = handle(true);
    const onOffline = handle(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const override = React.useCallback((next: boolean | null) => {
    overrideRef.current = next;
    if (next !== null) {
      setOnline(next);
      setSince(new Date());
    } else if (typeof navigator !== 'undefined') {
      setOnline(navigator.onLine);
      setSince(new Date());
    }
  }, []);

  return { online, since, override };
}
