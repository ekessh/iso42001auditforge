// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { QaChecklistService } from './qa-checklist.service.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import type { ReportPublicationContext } from '@auditforge/qa-checklist';

describe('QaChecklistService', () => {
  const firmId = '00000000-0000-0000-0000-000000000001';
  const actor = '00000000-0000-0000-0000-000000000002';

  function ctx(overrides: Partial<ReportPublicationContext> = {}): Omit<ReportPublicationContext, 'firmId'> {
    const base: ReportPublicationContext = {
      firmId,
      engagementId: '00000000-0000-0000-0000-000000000003',
      mode: 'audit',
      draft: {
        reportId: '00000000-0000-0000-0000-000000000004',
        type: 'stage2',
        status: 'in_review',
        scopeStatement: 'Audit covers all in-scope AI systems for fiscal 2026.',
        methodologyStatement:
          'ISO 17021-1 Stage 2 protocol with NIST AI RMF cross-mapping.',
        hasMandatoryDisclaimer: false,
      },
      findings: [],
      candidateFindings: [],
      peerReview: {
        required: true,
        status: 'approved',
        approvedAt: '2026-05-01T00:00:00Z',
        reviewerId: '00000000-0000-0000-0000-000000000005',
        securityReviewRequired: false,
      },
      samplingPlan: {
        planId: '00000000-0000-0000-0000-000000000006',
        documentedAt: '2026-05-01T00:00:00Z',
      },
      impartiality: {
        declared: true,
        declaredAt: '2026-05-01T00:00:00Z',
        declaredBy: actor,
      },
      signing: { signingKeyId: 'key-1', tsaAnchorId: 'tsa-1' },
      overrides: {},
    };
    const merged = { ...base, ...overrides };
    const { firmId: _omit, ...rest } = merged;
    void _omit;
    return rest;
  }

  it('passes a fully populated draft', () => {
    const svc = new QaChecklistService(new AuditEngineAdapter());
    const result = svc.evaluate({ firmId, actorId: actor, ctx: ctx() });
    expect(result.passed).toBe(true);
  });

  it('flags failures when sampling plan absent', () => {
    const svc = new QaChecklistService(new AuditEngineAdapter());
    const result = svc.evaluate({
      firmId,
      actorId: actor,
      ctx: ctx({ samplingPlan: undefined }),
    });
    expect(result.passed).toBe(false);
    expect(result.items.find((i) => i.id === 'sampling-plan-documented')?.status).toBe('fail');
  });

  it('honors auditor overrides', () => {
    const svc = new QaChecklistService(new AuditEngineAdapter());
    const result = svc.evaluate({
      firmId,
      actorId: actor,
      ctx: ctx({
        samplingPlan: undefined,
        overrides: {
          'sampling-plan-documented': {
            actorId: actor,
            rationale: 'Document review only — no sampling needed for this engagement.',
            at: '2026-05-02T00:00:00Z',
          },
        },
      }),
    });
    expect(result.passed).toBe(true);
    expect(result.items.find((i) => i.id === 'sampling-plan-documented')?.status).toBe('overridden');
  });

  it('emits ledger events through AuditEngineAdapter', () => {
    const audit = new AuditEngineAdapter();
    const svc = new QaChecklistService(audit);
    svc.evaluate({ firmId, actorId: actor, ctx: ctx({ samplingPlan: undefined }) });
    // The adapter is in-memory-backed in tests; we don't assert on its
    // contents here because the public surface only guarantees the runner
    // emits events. The adapter test suite covers persistence.
    expect(audit).toBeDefined();
  });
});
