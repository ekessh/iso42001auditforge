// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  channelName,
  InMemoryListenNotifyAdapter,
  InMemoryWebSocketBroadcaster,
  type BroadcasterClient,
  type NotificationPayload,
} from '../src/index.js';

const ENG = '11111111-1111-4111-8111-111111111111';

describe('channelName', () => {
  it('formats channel with engagement ID', () => {
    expect(channelName('coverage_state', ENG)).toBe(`coverage_state:${ENG}`);
    expect(channelName('candidate_finding_event', ENG)).toBe(
      `candidate_finding_event:${ENG}`,
    );
  });
});

describe('InMemoryListenNotifyAdapter', () => {
  it('delivers a published payload to subscribers', async () => {
    const a = new InMemoryListenNotifyAdapter();
    const calls: NotificationPayload[] = [];
    await a.subscribe('coverage_state', ENG, (p) => calls.push(p));
    await a.publish({
      channel: 'coverage_state',
      engagementId: ENG,
      at: '2026-05-03T10:00:00.000Z',
      data: { clauseId: '4.1', status: 'evidenced' },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.data['status']).toBe('evidenced');
  });

  it('does not cross channels', async () => {
    const a = new InMemoryListenNotifyAdapter();
    const calls: NotificationPayload[] = [];
    await a.subscribe('coverage_state', ENG, (p) => calls.push(p));
    await a.publish({
      channel: 'candidate_finding_event',
      engagementId: ENG,
      at: '2026-05-03T10:00:00.000Z',
      data: {},
    });
    expect(calls).toHaveLength(0);
  });

  it('unsubscribe stops delivery', async () => {
    const a = new InMemoryListenNotifyAdapter();
    const calls: NotificationPayload[] = [];
    const unsub = await a.subscribe('coverage_state', ENG, (p) => calls.push(p));
    await unsub();
    await a.publish({
      channel: 'coverage_state',
      engagementId: ENG,
      at: '2026-05-03T10:00:00.000Z',
      data: {},
    });
    expect(calls).toHaveLength(0);
  });

  it('rejects invalid payloads', async () => {
    const a = new InMemoryListenNotifyAdapter();
    await expect(
      a.publish({
        channel: 'coverage_state',
        engagementId: 'not-a-uuid' as never,
        at: '2026-05-03T10:00:00.000Z',
        data: {},
      }),
    ).rejects.toThrow();
  });
});

describe('InMemoryWebSocketBroadcaster', () => {
  it('fans broadcast to clients of the same engagement', async () => {
    const b = new InMemoryWebSocketBroadcaster();
    const recv: NotificationPayload[] = [];
    const client: BroadcasterClient = {
      id: 'c1',
      engagementId: ENG,
      send: (p) => recv.push(p),
    };
    await b.attach(client);
    await b.broadcast('coverage_state', ENG, {
      channel: 'coverage_state',
      engagementId: ENG,
      at: '2026-05-03T10:00:00.000Z',
      data: { clauseId: '4.1' },
    });
    expect(recv).toHaveLength(1);
  });

  it('does not deliver to other engagements', async () => {
    const b = new InMemoryWebSocketBroadcaster();
    const recv: NotificationPayload[] = [];
    const client: BroadcasterClient = {
      id: 'c1',
      engagementId: ENG,
      send: (p) => recv.push(p),
    };
    await b.attach(client);
    await b.broadcast('coverage_state', '22222222-2222-4222-8222-222222222222', {
      channel: 'coverage_state',
      engagementId: '22222222-2222-4222-8222-222222222222',
      at: '2026-05-03T10:00:00.000Z',
      data: {},
    });
    expect(recv).toHaveLength(0);
  });

  it('detach removes client from rotation', async () => {
    const b = new InMemoryWebSocketBroadcaster();
    const recv: NotificationPayload[] = [];
    const client: BroadcasterClient = {
      id: 'c1',
      engagementId: ENG,
      send: (p) => recv.push(p),
    };
    await b.attach(client);
    await b.detach('c1');
    await b.broadcast('coverage_state', ENG, {
      channel: 'coverage_state',
      engagementId: ENG,
      at: '2026-05-03T10:00:00.000Z',
      data: {},
    });
    expect(recv).toHaveLength(0);
    expect(b.size()).toBe(0);
  });
});
