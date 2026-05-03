// SPDX-License-Identifier: BUSL-1.1
import type { SurveillanceAlert } from './domain.js';

/**
 * AlertDispatcher — channel-pluggable, no hard transport dependencies.
 *
 * Channel implementations (email, slack, webhook, in-app inbox) implement the
 * `AlertChannel` interface and are registered with the dispatcher. Failures in
 * one channel do NOT prevent other channels from being notified.
 */

export interface AlertChannel {
  /** Stable channel id, e.g. "email", "slack". */
  readonly id: string;
  /** Returns the set of severities this channel cares about. */
  readonly severities: ReadonlySet<SurveillanceAlert['severity']>;
  /** Deliver one alert; should not throw — catch internally and resolve to a result. */
  deliver(alert: SurveillanceAlert): Promise<void>;
}

export interface DispatchResult {
  alertId: string;
  attempts: ReadonlyArray<{
    channelId: string;
    ok: boolean;
    error: string | undefined;
  }>;
}

export class AlertDispatcher {
  private readonly channels = new Map<string, AlertChannel>();

  register(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
  }

  unregister(channelId: string): void {
    this.channels.delete(channelId);
  }

  has(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  size(): number {
    return this.channels.size;
  }

  async dispatch(alert: SurveillanceAlert): Promise<DispatchResult> {
    const attempts: Array<{ channelId: string; ok: boolean; error: string | undefined }> =
      [];
    for (const channel of this.channels.values()) {
      if (!channel.severities.has(alert.severity)) continue;
      try {
        await channel.deliver(alert);
        attempts.push({ channelId: channel.id, ok: true, error: undefined });
      } catch (e) {
        attempts.push({
          channelId: channel.id,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return { alertId: alert.alertId, attempts };
  }
}

/** In-memory channel — useful for tests and the in-app auditor inbox. */
export class InMemoryAlertChannel implements AlertChannel {
  readonly id: string;
  readonly severities: ReadonlySet<SurveillanceAlert['severity']>;
  private readonly fail: boolean;
  readonly received: SurveillanceAlert[] = [];

  constructor(
    id: string,
    severities: ReadonlyArray<SurveillanceAlert['severity']> = ['warning', 'critical'],
    options: { fail?: boolean } = {},
  ) {
    this.id = id;
    this.severities = new Set(severities);
    this.fail = options.fail ?? false;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deliver(alert: SurveillanceAlert): Promise<void> {
    if (this.fail) throw new Error(`channel ${this.id} forced failure`);
    this.received.push(alert);
  }
}
