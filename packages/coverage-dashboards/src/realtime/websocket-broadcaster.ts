// SPDX-License-Identifier: BUSL-1.1
/**
 * WebSocket broadcaster interface. The Postgres LISTEN/NOTIFY adapter publishes
 * notifications, the broadcaster fans them out to connected dashboard clients.
 *
 * Concrete implementation (ws / socket.io / fastify-websocket) lives at the
 * app layer; this module pins the contract and supplies an in-memory
 * implementation for tests.
 */
import type {
  ListenChannel,
  NotificationPayload,
} from './listen-notify.js';

export interface BroadcasterClient {
  readonly id: string;
  readonly engagementId: string;
  send(payload: NotificationPayload): void;
}

export interface WebSocketBroadcaster {
  attach(client: BroadcasterClient): Promise<void>;
  detach(clientId: string): Promise<void>;
  /** Bridge a notification onto all subscribed clients. */
  broadcast(
    channel: ListenChannel,
    engagementId: string,
    payload: NotificationPayload,
  ): Promise<void>;
}

export class InMemoryWebSocketBroadcaster implements WebSocketBroadcaster {
  private readonly clients = new Map<string, BroadcasterClient>();
  /** Per-engagement client buckets for O(1) fan-out. */
  private readonly byEngagement = new Map<string, Set<BroadcasterClient>>();

  async attach(client: BroadcasterClient): Promise<void> {
    this.clients.set(client.id, client);
    let set = this.byEngagement.get(client.engagementId);
    if (!set) {
      set = new Set();
      this.byEngagement.set(client.engagementId, set);
    }
    set.add(client);
  }

  async detach(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);
    const bucket = this.byEngagement.get(client.engagementId);
    bucket?.delete(client);
  }

  async broadcast(
    _channel: ListenChannel,
    engagementId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const bucket = this.byEngagement.get(engagementId);
    if (!bucket) return;
    for (const c of bucket) c.send(payload);
  }

  /** Test helpers. */
  size(): number {
    return this.clients.size;
  }
}
