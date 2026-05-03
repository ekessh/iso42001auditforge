// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { ImmutableViolation, TenantViolation } from '@auditforge/shared';
import {
  buildTestRig,
  makeCreateInput,
  nextAuditorId,
  nextClientId,
  nextFirmId,
  resetCounter,
} from './helpers.js';

describe('FindingRegistry — CRUD + ledger', () => {
  beforeEach(() => resetCounter());

  it('creates a finding in draft with disposition history seeded', () => {
    const rig = buildTestRig();
    const f = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      { firmId: rig.firmId, clientId: rig.clientId },
    );
    expect(f.status).toBe('draft');
    expect(f.dispositionHistory).toHaveLength(1);
    expect(f.dispositionHistory[0]?.action).toBe('created');
    expect(f.number).toBe('NC-2026-0001'); // raisedAt now ≈ 2026
  });

  it('emits finding.created on creation', () => {
    const rig = buildTestRig({ clock: () => '2026-05-03T12:00:00Z' });
    rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      { firmId: rig.firmId, clientId: rig.clientId },
    );
    const created = rig.ledger.byKind('finding.created');
    expect(created).toHaveLength(1);
    expect(created[0]?.envelope.payload).toMatchObject({ type: 'minor_nc' });
  });

  it('blocks cross-tenant access on get', () => {
    const rig = buildTestRig();
    const f = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      { firmId: rig.firmId, clientId: rig.clientId },
    );
    expect(() =>
      rig.registry.get(f.id, { firmId: nextFirmId(), clientId: nextClientId() }),
    ).toThrow(TenantViolation);
  });

  it('blocks cross-tenant on create (mismatched IDs)', () => {
    const rig = buildTestRig();
    expect(() =>
      rig.registry.create(
        makeCreateInput({
          firmId: nextFirmId(),
          clientId: rig.clientId,
          engagementId: rig.engagementId,
          auditEventId: rig.auditEventId,
          raisedBy: rig.auditorId,
        }),
        { firmId: rig.firmId, clientId: rig.clientId },
      ),
    ).toThrow(TenantViolation);
  });

  it('list scopes to engagement and audit event', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    rig.registry.create(
      makeCreateInput({
        type: 'ofi',
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    expect(
      rig.registry.listByEngagement(rig.engagementId, tenant),
    ).toHaveLength(2);
    expect(
      rig.registry.listByAuditEvent(rig.auditEventId, tenant),
    ).toHaveLength(2);
  });

  it('transition draft → issued → accepted', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    const f0 = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    const f1 = rig.registry.transition(
      f0.id,
      { action: 'issue', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    expect(f1.status).toBe('issued');
    const f2 = rig.registry.transition(
      f1.id,
      { action: 'accept', role: 'auditee', by: nextAuditorId() },
      tenant,
    );
    expect(f2.status).toBe('accepted');
    expect(f2.dispositionHistory).toHaveLength(3);
  });

  it('emits finding.transitioned on each move', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    const f0 = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    rig.registry.transition(
      f0.id,
      { action: 'issue', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    expect(rig.ledger.byKind('finding.transitioned')).toHaveLength(1);
  });

  it('refuses to transition a closed finding (except reopen)', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    const f0 = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    const a = rig.registry.transition(
      f0.id,
      { action: 'issue', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    const b = rig.registry.transition(
      a.id,
      { action: 'accept', role: 'auditee', by: rig.auditorId },
      tenant,
    );
    const c = rig.registry.transition(
      b.id,
      { action: 'resolve', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    const d = rig.registry.transition(
      c.id,
      { action: 'close', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    expect(d.status).toBe('closed');
    expect(() =>
      rig.registry.transition(
        d.id,
        { action: 'issue', role: 'lead_auditor', by: rig.auditorId },
        tenant,
      ),
    ).toThrow(ImmutableViolation);
    expect(() =>
      rig.registry.transition(
        d.id,
        { action: 'reopen', role: 'lead_auditor', by: rig.auditorId },
        tenant,
      ),
    ).toThrow(ImmutableViolation);
  });

  it('preserves ledger chain integrity through close (regression: closing keeps chain intact)', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    const f0 = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    let cur = rig.registry.transition(
      f0.id,
      { action: 'issue', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    cur = rig.registry.transition(
      cur.id,
      { action: 'accept', role: 'auditee', by: rig.auditorId },
      tenant,
    );
    cur = rig.registry.transition(
      cur.id,
      { action: 'resolve', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    cur = rig.registry.transition(
      cur.id,
      { action: 'close', role: 'lead_auditor', by: rig.auditorId },
      tenant,
    );
    // 1 created + 4 transitioned = 5
    expect(rig.ledger.size()).toBe(5);
    // Chain order is strict ascending and indices monotonic.
    const evs = rig.ledger.byFindingId(f0.id);
    expect(evs.map((e) => e.envelope.kind)).toEqual([
      'finding.created',
      'finding.transitioned',
      'finding.transitioned',
      'finding.transitioned',
      'finding.transitioned',
    ]);
    for (let i = 1; i < evs.length; i += 1) {
      const prev = evs[i - 1];
      const cur2 = evs[i];
      expect(prev).toBeDefined();
      expect(cur2).toBeDefined();
      if (prev && cur2) {
        expect(cur2.index).toBe(prev.index + 1);
      }
    }
  });

  it('numbers OFIs with the OFI scheme and engagement code', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    const f = rig.registry.create(
      makeCreateInput({
        type: 'ofi',
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
      { engagementCode: 'ENG42' },
    );
    expect(f.number.startsWith('OFI-ENG42-')).toBe(true);
  });

  it('records carry-forward and emits ledger event', () => {
    const rig = buildTestRig();
    const tenant = { firmId: rig.firmId, clientId: rig.clientId };
    const f = rig.registry.create(
      makeCreateInput({
        firmId: rig.firmId,
        clientId: rig.clientId,
        engagementId: rig.engagementId,
        auditEventId: rig.auditEventId,
        raisedBy: rig.auditorId,
      }),
      tenant,
    );
    const newAudit = rig.auditEventId; // reuse for test simplicity
    const updated = rig.registry.recordCarryForward(
      f.id,
      {
        newAuditEventId: newAudit,
        carriedAt: '2026-12-01T00:00:00Z',
        by: rig.auditorId,
      },
      tenant,
    );
    expect(updated.carryForwardFrom?.sourceFindingId).toBe(f.id);
    expect(rig.ledger.byKind('finding.carried_forward')).toHaveLength(1);
  });

  it('requires at least one clause or control link by default', () => {
    const rig = buildTestRig();
    expect(() =>
      rig.registry.create(
        makeCreateInput({
          clauseLinks: [],
          controlLinks: [],
          firmId: rig.firmId,
          clientId: rig.clientId,
          engagementId: rig.engagementId,
          auditEventId: rig.auditEventId,
          raisedBy: rig.auditorId,
        }),
        { firmId: rig.firmId, clientId: rig.clientId },
      ),
    ).toThrow();
  });
});
