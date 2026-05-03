// SPDX-License-Identifier: BUSL-1.1
/**
 * Postgres LISTEN/NOTIFY adapter — interface only. Concrete drivers wire into
 * the chosen Postgres client (pg, postgres, etc.) at the app layer.
 *
 * Channel naming convention used across the engine:
 *
 *   coverage_state:<engagementId>          — coverage_state row changed
 *   candidate_finding_event:<engagementId> — candidate_findings row created/decided
 *   weight_config_event:<engagementId>     — readiness weight config changed
 */
import { z } from 'zod';
import { IsoDateSchema, UuidSchema } from '@auditforge/shared';

export const ListenChannelSchema = z.enum([
  'coverage_state',
  'candidate_finding_event',
  'weight_config_event',
]);
export type ListenChannel = z.infer<typeof ListenChannelSchema>;

export function channelName(
  channel: ListenChannel,
  engagementId: string,
): string {
  return `${channel}:${engagementId}`;
}

export const NotificationPayloadSchema = z.object({
  channel: ListenChannelSchema,
  engagementId: UuidSchema,
  at: IsoDateSchema,
  /** Free-form payload — schema-validated by listener-specific decoders. */
  data: z.record(z.string(), z.unknown()),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

export interface ListenNotifyAdapter {
  /** Subscribe to a channel for a specific engagement. Returns an unsubscribe handle. */
  subscribe(
    channel: ListenChannel,
    engagementId: string,
    handler: (payload: NotificationPayload) => void,
  ): Promise<Unsubscribe>;
  /** Publish a payload (used by integration tests and the orchestrator). */
  publish(payload: NotificationPayload): Promise<void>;
  /** Disconnect (test helpers). */
  close(): Promise<void>;
}

export type Unsubscribe = () => Promise<void>;

/**
 * In-memory implementation suitable for tests and local development.
 * Mirrors the Postgres adapter contract precisely; production uses the
 * pg-driver implementation in apps/api.
 */
export class InMemoryListenNotifyAdapter implements ListenNotifyAdapter {
  private readonly subs = new Map<
    string,
    Set<(p: NotificationPayload) => void>
  >();

  private key(channel: ListenChannel, engagementId: string): string {
    return channelName(channel, engagementId);
  }

  async subscribe(
    channel: ListenChannel,
    engagementId: string,
    handler: (payload: NotificationPayload) => void,
  ): Promise<Unsubscribe> {
    const k = this.key(channel, engagementId);
    let set = this.subs.get(k);
    if (!set) {
      set = new Set();
      this.subs.set(k, set);
    }
    set.add(handler);
    return async () => {
      set?.delete(handler);
    };
  }

  async publish(payload: NotificationPayload): Promise<void> {
    const parsed = NotificationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(
        `InMemoryListenNotifyAdapter.publish: invalid payload — ${parsed.error.issues
          .map((i) => i.message)
          .join('; ')}`,
      );
    }
    const k = this.key(payload.channel, payload.engagementId);
    const set = this.subs.get(k);
    if (!set) return;
    for (const h of set) h(parsed.data);
  }

  async close(): Promise<void> {
    this.subs.clear();
  }
}
