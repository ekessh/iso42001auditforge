// SPDX-License-Identifier: BUSL-1.1

export interface NetworkStatus {
  isOnline: boolean;
  lastSyncAt: number | null;
  pendingUpdateCount: number;
}

export interface NetworkProbe {
  /** Probe a small `/sync/health` endpoint. Should resolve true when online. */
  ping(): Promise<boolean>;
}

export interface NetworkMonitorOptions {
  probe: NetworkProbe;
  intervalMs?: number;
  initial?: boolean;
}

/**
 * WHY: Navigator.onLine is unreliable behind captive portals; we combine it
 * with an explicit /sync/health probe so the UI doesn't show "online" while
 * the auditor is actually on a captive-portal hotspot.
 */
export class NetworkMonitor {
  private readonly probe: NetworkProbe;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(online: boolean) => void>();
  private currentStatus: boolean;

  constructor(opts: NetworkMonitorOptions) {
    this.probe = opts.probe;
    this.intervalMs = opts.intervalMs ?? 15_000;
    this.currentStatus = opts.initial ?? true;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
      (this.timer as { unref?: () => void }).unref?.();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isOnline(): boolean {
    return this.currentStatus;
  }

  on(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async tick(): Promise<void> {
    const next = await this.safeProbe();
    if (next === this.currentStatus) return;
    this.currentStatus = next;
    for (const fn of this.listeners) fn(next);
  }

  private async safeProbe(): Promise<boolean> {
    try {
      return await this.probe.ping();
    } catch {
      return false;
    }
  }
}
