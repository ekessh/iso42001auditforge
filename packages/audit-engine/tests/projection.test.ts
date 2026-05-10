// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuditLedger,
  InMemoryEventRepository,
  InMemoryProjectionStore,
  ProjectionService,
  StubTsaProvider,
  createDefaultRegistry,
  type Projection,
  type LedgerEvent,
} from '../src/index.js';

const FIRM = '11111111-1111-1111-1111-111111111111';

interface AuditorState {
  byId: Record<string, { email?: string; role?: string }>;
}

const auditorProjection: Projection<AuditorState> = {
  name: 'auditor.view',
  initial: () => ({ byId: {} }),
  reduce(state: AuditorState, e: LedgerEvent): AuditorState {
    const next: AuditorState = { byId: { ...state.byId } };
    if (e.eventType === 'auditor.invited') {
      const id = String(e.payload.auditorId);
      next.byId[id] = { ...(next.byId[id] ?? {}), email: String(e.payload.email) };
    }
    if (e.eventType === 'auditor.role_assigned') {
      const id = String(e.payload.auditorId);
      next.byId[id] = { ...(next.byId[id] ?? {}), role: String(e.payload.role) };
    }
    return next;
  },
};

function ledger() {
  const repo = new InMemoryEventRepository();
  const l = new AuditLedger(repo, createDefaultRegistry(), new StubTsaProvider());
  return { repo, l };
}

describe('ProjectionService', () => {
  it('builds a projection by replaying events', async () => {
    const { repo, l } = ledger();
    const a = randomUUID();
    await l.emit({ firmId: FIRM, producer: 'p' }, 'auditor.invited', { auditorId: a, email: 'x@example.com' });
    await l.emit({ firmId: FIRM, producer: 'p' }, 'auditor.role_assigned', { auditorId: a, role: 'lead' });
    const svc = new ProjectionService(repo);
    const r = await svc.build(auditorProjection, { firmId: FIRM });
    expect(r.lastSequence).toBe(2);
    expect(r.state.byId[a]).toEqual({ email: 'x@example.com', role: 'lead' });
  });

  it('rebuild is idempotent (same input → same output)', async () => {
    const { repo, l } = ledger();
    const a = randomUUID();
    await l.emit({ firmId: FIRM, producer: 'p' }, 'auditor.invited', { auditorId: a, email: 'a@example.com' });
    const svc = new ProjectionService(repo, new InMemoryProjectionStore());
    const r1 = await svc.rebuild(auditorProjection, { firmId: FIRM });
    const r2 = await svc.rebuild(auditorProjection, { firmId: FIRM });
    expect(r1.state).toEqual(r2.state);
    expect(r1.lastSequence).toBe(r2.lastSequence);
  });

  it('catchUp advances the checkpoint and processes only new events', async () => {
    const { repo, l } = ledger();
    const a1 = randomUUID();
    const a2 = randomUUID();
    await l.emit({ firmId: FIRM, producer: 'p' }, 'auditor.invited', { auditorId: a1, email: 'a@example.com' });
    const store = new InMemoryProjectionStore();
    const svc = new ProjectionService(repo, store);
    const r1 = await svc.rebuild(auditorProjection, { firmId: FIRM });
    expect(r1.lastSequence).toBe(1);
    await l.emit({ firmId: FIRM, producer: 'p' }, 'auditor.invited', { auditorId: a2, email: 'b@example.com' });
    const r2 = await svc.catchUp(auditorProjection, { firmId: FIRM }, r1.state);
    expect(r2.lastSequence).toBe(2);
    expect(Object.keys(r2.state.byId).sort()).toEqual([a1, a2].sort());
  });
});
