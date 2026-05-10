// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuditLedger,
  InMemoryEventRepository,
  InMemoryOutboxRepository,
  Outbox,
  StubTsaProvider,
  createDefaultRegistry,
} from '../src/index.js';

const FIRM = '11111111-1111-1111-1111-111111111111';

function fixture() {
  const repo = new InMemoryEventRepository();
  const ledger = new AuditLedger(repo, createDefaultRegistry(), new StubTsaProvider());
  const outboxRepo = new InMemoryOutboxRepository();
  const outbox = new Outbox(outboxRepo);
  return { ledger, repo, outbox, outboxRepo };
}

describe('Outbox', () => {
  it('enqueues and drains pending events into the ledger', async () => {
    const { ledger, repo, outbox, outboxRepo } = fixture();
    await outbox.enqueue({
      ctx: { firmId: FIRM, producer: 'svc-a' },
      eventType: 'firm.created',
      payload: { firmId: FIRM, name: 'A' },
    });
    await outbox.enqueue({
      ctx: { firmId: FIRM, producer: 'svc-a' },
      eventType: 'auditor.invited',
      payload: { auditorId: randomUUID(), email: 'a@example.com' },
    });
    const r = await outbox.drain(ledger);
    expect(r.processed).toBe(2);
    expect(r.failed).toBe(0);
    const events = await repo.list({ firmId: FIRM });
    expect(events).toHaveLength(2);
    const all = await outboxRepo.list();
    expect(all.every((x) => x.status === 'consumed')).toBe(true);
    expect(all.every((x) => x.ledgerEventId !== undefined)).toBe(true);
  });

  it('marks a record failed when payload is invalid', async () => {
    const { ledger, outbox, outboxRepo } = fixture();
    await outbox.enqueue({
      ctx: { firmId: FIRM, producer: 'svc-a' },
      eventType: 'firm.created',
      payload: { name: 'no firmId' },
    });
    const r = await outbox.drain(ledger);
    expect(r.failed).toBe(1);
    const all = await outboxRepo.list();
    expect(all[0]?.status).toBe('failed');
    expect(all[0]?.lastError).toMatch(/Invalid event payload/);
  });

  it('drain is idempotent — re-running on consumed records does nothing', async () => {
    const { ledger, outbox, repo } = fixture();
    await outbox.enqueue({
      ctx: { firmId: FIRM, producer: 'svc' },
      eventType: 'firm.created',
      payload: { firmId: FIRM, name: 'A' },
    });
    await outbox.drain(ledger);
    await outbox.drain(ledger);
    const events = await repo.list({ firmId: FIRM });
    expect(events).toHaveLength(1);
  });
});
