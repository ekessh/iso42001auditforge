// SPDX-License-Identifier: BUSL-1.1
'use client';

import { NetworkMonitor, type NetworkProbe } from '@auditforge/working-papers';

export class FetchHealthProbe implements NetworkProbe {
  constructor(private readonly url: string = '/api/v1/sync/health') {}

  async ping(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }
    try {
      const r = await fetch(this.url, { method: 'GET', cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }
}

export function createBrowserNetworkMonitor(opts?: {
  url?: string;
  intervalMs?: number;
}): NetworkMonitor {
  const probe = new FetchHealthProbe(opts?.url);
  const initial = typeof navigator !== 'undefined' ? navigator.onLine : true;
  return new NetworkMonitor({
    probe,
    intervalMs: opts?.intervalMs ?? 15_000,
    initial,
  });
}
