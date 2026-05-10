// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import type {
  CandidateFindingState,
  FindingEvidenceLink,
  ReportPublicationContext,
} from '../src/domain/context.js';

export function ctxBuilder(overrides: Partial<ReportPublicationContext> = {}): ReportPublicationContext {
  const firmId = '00000000-0000-0000-0000-000000000001';
  const engagementId = '00000000-0000-0000-0000-000000000002';
  const reportId = '00000000-0000-0000-0000-000000000003';
  const auditorId = '00000000-0000-0000-0000-000000000004';
  const reviewerId = '00000000-0000-0000-0000-000000000005';
  const at = '2026-05-01T12:00:00.000Z';
  const base: ReportPublicationContext = {
    firmId,
    engagementId,
    mode: 'audit',
    draft: {
      reportId,
      type: 'stage2',
      status: 'in_review',
      scopeStatement: 'Audit of the AIMS covering all in-scope AI systems for 2026.',
      methodologyStatement:
        'ISO 17021-1 + ISO 42001:2023 audit using Stage 2 protocol with NIST AI RMF mapping.',
      hasMandatoryDisclaimer: false,
    },
    findings: [],
    candidateFindings: [],
    peerReview: {
      required: true,
      status: 'approved',
      approvedAt: at,
      reviewerId,
      securityReviewRequired: false,
    },
    samplingPlan: { planId: randomUUID(), documentedAt: at },
    impartiality: { declared: true, declaredAt: at, declaredBy: auditorId },
    signing: { signingKeyId: 'key-1', tsaAnchorId: 'tsa-1' },
    overrides: {},
  };
  return { ...base, ...overrides };
}

export function findingWithoutEvidence(): FindingEvidenceLink {
  return { findingId: randomUUID(), evidenceRefs: [] };
}

export function findingWithEvidence(): FindingEvidenceLink {
  return { findingId: randomUUID(), evidenceRefs: [randomUUID()] };
}

export function openCandidate(): CandidateFindingState {
  return { candidateId: randomUUID(), status: 'open' };
}
export function dismissedCandidate(): CandidateFindingState {
  return { candidateId: randomUUID(), status: 'dismissed' };
}
