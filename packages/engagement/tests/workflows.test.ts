// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';

import { Stage1Workflow } from '../src/workflows/stage1.js';
import { Stage2Workflow } from '../src/workflows/stage2.js';
import { SurveillanceWorkflow } from '../src/workflows/surveillance.js';
import { RecertificationWorkflow } from '../src/workflows/recertification.js';
import { SpecialAuditWorkflow } from '../src/workflows/special.js';
import { StateMachine } from '../src/workflows/machine.js';
import { InMemoryLedger, type TenantContext } from '../src/ports.js';
import type {
  AuditorId,
  EngagementId,
  FirmId,
} from '@auditforge/shared';

const tenant: TenantContext = {
  firmId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' as unknown as FirmId,
  auditorId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' as unknown as AuditorId,
  engagementId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc' as unknown as EngagementId,
};

let ledger: InMemoryLedger;
beforeEach(() => {
  ledger = new InMemoryLedger();
});

describe('Stage1Workflow', () => {
  it('happy path: docReview -> scopeVerification -> readinessAssess -> stage2Decision -> complete', async () => {
    const wf = new Stage1Workflow(tenant, ledger);
    expect(wf.state()).toBe('docReview');
    await wf.transition('scopeVerification');
    await wf.transition('readinessAssess');
    await wf.transition('stage2Decision');
    await wf.transition('complete');
    expect(wf.state()).toBe('complete');
    expect(ledger.byType('workflow.stage1.transitioned')).toHaveLength(4);
  });

  it('rejects skipping states', async () => {
    const wf = new Stage1Workflow(tenant, ledger);
    await expect(wf.transition('complete')).rejects.toThrow();
  });

  it('exhaustively enumerates all defined transitions', () => {
    const map = Stage1Workflow.transitions();
    const all = StateMachine.enumerate(map);
    // 6 states, defined transitions:
    // docReview->2 + scopeVerification->2 + readinessAssess->2 + stage2Decision->2 + complete->0 + abandoned->0 = 8
    expect(all).toHaveLength(8);
  });

  it('terminal states have no outgoing transitions', () => {
    const map = Stage1Workflow.transitions();
    expect(map.complete).toEqual([]);
    expect(map.abandoned).toEqual([]);
  });
});

describe('Stage2Workflow', () => {
  it('happy path: opening -> areaSessions -> closing -> reportDraft -> complete', async () => {
    const wf = new Stage2Workflow(tenant, ledger);
    await wf.transition('areaSessions');
    await wf.transition('closing');
    await wf.transition('reportDraft');
    await wf.transition('complete');
    expect(wf.state()).toBe('complete');
  });

  it('allows interim review in the middle', async () => {
    const wf = new Stage2Workflow(tenant, ledger);
    await wf.transition('areaSessions');
    await wf.transition('interimReview');
    await wf.transition('areaSessions');
    expect(wf.state()).toBe('areaSessions');
  });

  it('reportDraft can return to closing for revisions', async () => {
    const wf = new Stage2Workflow(tenant, ledger);
    await wf.transition('areaSessions');
    await wf.transition('closing');
    await wf.transition('reportDraft');
    await wf.transition('closing');
    expect(wf.state()).toBe('closing');
  });

  it('any state may abandon (except terminals)', async () => {
    const wf = new Stage2Workflow(tenant, ledger);
    await wf.transition('areaSessions');
    await wf.transition('abandoned');
    expect(wf.state()).toBe('abandoned');
  });
});

describe('SurveillanceWorkflow', () => {
  it('completes the full surveillance path', async () => {
    const wf = new SurveillanceWorkflow(tenant, ledger);
    await wf.transition('reducedScopeAudit');
    await wf.transition('schemeComplianceCheck');
    await wf.transition('reportDraft');
    await wf.transition('complete');
    expect(wf.state()).toBe('complete');
  });
});

describe('RecertificationWorkflow', () => {
  it('completes the full recert path', async () => {
    const wf = new RecertificationWorkflow(tenant, ledger);
    await wf.transition('fullReAudit');
    await wf.transition('reportDraft');
    await wf.transition('decision');
    await wf.transition('complete');
    expect(wf.state()).toBe('complete');
  });
});

describe('SpecialAuditWorkflow', () => {
  it.each([
    'scope_extension',
    'transfer',
    'short_notice',
    'witnessed',
  ] as const)('%s subtype completes', async (subtype) => {
    const wf = new SpecialAuditWorkflow(subtype, tenant, ledger);
    expect(wf.subtype).toBe(subtype);
    await wf.transition('inProgress');
    await wf.transition('reportDraft');
    await wf.transition('complete');
    expect(wf.state()).toBe('complete');
    // Each subtype should emit a uniquely-named event
    expect(ledger.byType(`workflow.special.${subtype}.transitioned`)).not.toHaveLength(0);
  });
});

describe('StateMachine.enumerate cardinality', () => {
  it('Stage 2 has all expected transitions', () => {
    const all = StateMachine.enumerate(Stage2Workflow.transitions());
    // 7 states -> opening:2, areaSessions:3, interimReview:3, closing:2, reportDraft:2, complete:0, abandoned:0 = 12
    expect(all).toHaveLength(12);
  });

  it('Surveillance has all expected transitions', () => {
    const all = StateMachine.enumerate(SurveillanceWorkflow.transitions());
    // ncFollowUp:2, reducedScopeAudit:2, schemeComplianceCheck:2, reportDraft:2, complete:0, abandoned:0 = 8
    expect(all).toHaveLength(8);
  });

  it('Recertification has all expected transitions', () => {
    const all = StateMachine.enumerate(RecertificationWorkflow.transitions());
    // performanceTrendReview:2, fullReAudit:2, reportDraft:2, decision:2, complete:0, abandoned:0 = 8
    expect(all).toHaveLength(8);
  });

  it('Special has all expected transitions', () => {
    const all = StateMachine.enumerate(SpecialAuditWorkflow.transitions());
    // scoped:2, inProgress:2, reportDraft:2, complete:0, abandoned:0 = 6
    expect(all).toHaveLength(6);
  });
});

describe('StateMachine — same-state no-op', () => {
  it('returns current state without ledger emit', async () => {
    const wf = new Stage1Workflow(tenant, ledger);
    await wf.transition('docReview');
    expect(ledger.list()).toHaveLength(0);
  });
});
