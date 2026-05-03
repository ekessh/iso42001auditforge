// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { PlanReceiptStateMachine } from '../src/plan/receipt.js';
import { buildPlan } from '../src/plan/builder.js';
import { NoopPlanExportAdapter } from '../src/plan/export.js';
import type { AuditEventId, EngagementId } from '@auditforge/shared';

const ENG = 'cccccccc-cccc-4ccc-cccc-cccccccccccc' as unknown as EngagementId;
const EVT = 'dddddddd-dddd-4ddd-dddd-dddddddddddd' as unknown as AuditEventId;

describe('PlanReceiptStateMachine', () => {
  it('initial state is `sent` and transitions to received', () => {
    const plan = buildPlan({ engagementId: ENG, auditEventId: EVT, sessions: [] });
    expect(plan.receipt.status).toBe('sent');
    const after = PlanReceiptStateMachine.transition(
      plan.receipt,
      'received',
      '2026-05-01T08:00:00Z',
    );
    expect(after.status).toBe('received');
    expect(after.receivedAt).toBe('2026-05-01T08:00:00Z');
  });

  it('rejects illegal transitions', () => {
    const plan = buildPlan({ engagementId: ENG, auditEventId: EVT, sessions: [] });
    expect(() =>
      PlanReceiptStateMachine.transition(plan.receipt, 'acknowledged', 'now'),
    ).toThrow();
  });

  it('comments transition to commented', () => {
    const plan = buildPlan({ engagementId: ENG, auditEventId: EVT, sessions: [] });
    const after = PlanReceiptStateMachine.addComment(plan.receipt, {
      id: 'c1',
      authorName: 'Auditee',
      text: 'Move opening to 09:30',
      createdAt: '2026-05-01T09:00:00Z',
      resolved: false,
    });
    expect(after.status).toBe('commented');
    expect(after.comments).toHaveLength(1);
  });

  it('cannot comment on an acknowledged plan', () => {
    const plan = buildPlan({ engagementId: ENG, auditEventId: EVT, sessions: [] });
    const received = PlanReceiptStateMachine.transition(
      plan.receipt,
      'received',
      'now',
    );
    const ack = PlanReceiptStateMachine.transition(received, 'acknowledged', 'now');
    expect(() =>
      PlanReceiptStateMachine.addComment(ack, {
        id: 'c1',
        authorName: 'Auditee',
        text: 'Late objection',
        createdAt: 'now',
        resolved: false,
      }),
    ).toThrow();
  });

  it('full path: sent -> received -> commented -> received -> acknowledged', () => {
    const plan = buildPlan({ engagementId: ENG, auditEventId: EVT, sessions: [] });
    let r = PlanReceiptStateMachine.transition(plan.receipt, 'received', 't1');
    r = PlanReceiptStateMachine.addComment(r, {
      id: 'c1',
      authorName: 'A',
      text: 'x',
      createdAt: 't2',
      resolved: false,
    });
    r = PlanReceiptStateMachine.transition(r, 'received', 't3');
    r = PlanReceiptStateMachine.transition(r, 'acknowledged', 't4');
    expect(r.status).toBe('acknowledged');
    expect(r.acknowledgedAt).toBe('t4');
  });
});

describe('NoopPlanExportAdapter', () => {
  it('returns non-empty bytes for both formats', async () => {
    const plan = buildPlan({ engagementId: ENG, auditEventId: EVT, sessions: [] });
    const adapter = new NoopPlanExportAdapter();
    const docx = await adapter.renderDocx(plan);
    const pdf = await adapter.renderPdf(plan);
    expect(docx.byteLength).toBeGreaterThan(0);
    expect(pdf.byteLength).toBeGreaterThan(0);
  });
});
