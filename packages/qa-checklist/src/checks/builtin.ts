// SPDX-License-Identifier: BUSL-1.1
import type { ChecklistCheck } from './check.js';

export const SCOPE_STATEMENT_CHECK: ChecklistCheck = {
  id: 'scope-statement',
  name: 'Scope clearly stated',
  evaluate(ctx) {
    if (ctx.draft.scopeStatement.trim().length < 24) {
      return { status: 'fail', reason: 'Scope statement is empty or too short (<24 chars).' };
    }
    return { status: 'pass', reason: '' };
  },
};

export const METHODOLOGY_SECTION_CHECK: ChecklistCheck = {
  id: 'methodology-section',
  name: 'Methodology section present',
  evaluate(ctx) {
    if (ctx.draft.methodologyStatement.trim().length < 24) {
      return { status: 'fail', reason: 'Methodology statement is empty or too short.' };
    }
    return { status: 'pass', reason: '' };
  },
};

export const FINDINGS_HAVE_EVIDENCE_CHECK: ChecklistCheck = {
  id: 'findings-have-evidence',
  name: 'All findings have evidence linked',
  evaluate(ctx) {
    const orphans = ctx.findings.filter((f) => f.evidenceRefs.length === 0).map((f) => f.findingId);
    if (orphans.length > 0) {
      return {
        status: 'fail',
        reason: `Findings without evidence: ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? `, ... (+${orphans.length - 5})` : ''}.`,
      };
    }
    return { status: 'pass', reason: '' };
  },
};

export const CANDIDATE_FINDINGS_RESOLVED_CHECK: ChecklistCheck = {
  id: 'candidate-findings-resolved',
  name: 'All candidate findings resolved (promoted or dismissed)',
  evaluate(ctx) {
    const open = ctx.candidateFindings.filter((cf) => cf.status === 'open');
    if (open.length > 0) {
      return {
        status: 'fail',
        reason: `${open.length} candidate finding(s) still open. Resolve before publication.`,
      };
    }
    return { status: 'pass', reason: '' };
  },
};

export const PEER_REVIEW_APPROVED_CHECK: ChecklistCheck = {
  id: 'peer-review-approved',
  name: 'Peer review approved',
  evaluate(ctx) {
    if (!ctx.peerReview.required) {
      return { status: 'skipped', reason: 'Peer review not required for this report type.' };
    }
    if (ctx.peerReview.status !== 'approved' || !ctx.peerReview.approvedAt) {
      return {
        status: 'fail',
        reason: `Peer review not approved (current: ${ctx.peerReview.status ?? 'pending'}).`,
      };
    }
    return { status: 'pass', reason: '' };
  },
};

export const SECURITY_REVIEW_APPROVED_CHECK: ChecklistCheck = {
  id: 'security-review-approved',
  name: 'Security/data-protection review approved (when required)',
  evaluate(ctx) {
    if (!ctx.peerReview.securityReviewRequired) {
      return { status: 'skipped', reason: 'Security review not required for engagement scope.' };
    }
    if (!ctx.peerReview.securityReviewerId || !ctx.peerReview.securityApprovedAt) {
      return {
        status: 'fail',
        reason: 'Engagement scope requires a security reviewer; second review missing.',
      };
    }
    return { status: 'pass', reason: '' };
  },
};

export const IMPARTIALITY_DECLARED_CHECK: ChecklistCheck = {
  id: 'impartiality-declared',
  name: 'Impartiality declared by lead auditor',
  evaluate(ctx) {
    if (!ctx.impartiality.declared || !ctx.impartiality.declaredBy) {
      return { status: 'fail', reason: 'Impartiality declaration missing.' };
    }
    return { status: 'pass', reason: '' };
  },
};

export const SAMPLING_PLAN_DOCUMENTED_CHECK: ChecklistCheck = {
  id: 'sampling-plan-documented',
  name: 'Sampling plan documented',
  evaluate(ctx) {
    if (!ctx.samplingPlan) {
      return { status: 'fail', reason: 'No sampling plan attached to engagement.' };
    }
    return { status: 'pass', reason: '' };
  },
};

export const SIGNING_KEY_RECORDED_CHECK: ChecklistCheck = {
  id: 'signing-key-recorded',
  name: 'Signing key id recorded',
  evaluate(ctx) {
    if (!ctx.signing.signingKeyId) {
      return { status: 'fail', reason: 'No signing key id present.' };
    }
    return { status: 'pass', reason: '' };
  },
};

export const TSA_ANCHOR_PRESENT_CHECK: ChecklistCheck = {
  id: 'tsa-anchor-present',
  name: 'TSA anchor present',
  evaluate(ctx) {
    if (!ctx.signing.tsaAnchorId) {
      return { status: 'fail', reason: 'TSA anchor not yet generated.' };
    }
    return { status: 'pass', reason: '' };
  },
};

export const READINESS_DISCLAIMER_CHECK: ChecklistCheck = {
  id: 'readiness-disclaimer',
  name: 'Mandatory non-certification disclaimer present (Readiness Mode)',
  evaluate(ctx) {
    if (ctx.mode !== 'readiness') {
      return { status: 'skipped', reason: 'Disclaimer only required for Readiness Mode.' };
    }
    if (!ctx.draft.hasMandatoryDisclaimer) {
      return {
        status: 'fail',
        reason: 'Readiness Mode reports must carry the non-certification disclaimer.',
      };
    }
    return { status: 'pass', reason: '' };
  },
};

export const DEFAULT_CHECKS: readonly ChecklistCheck[] = [
  SCOPE_STATEMENT_CHECK,
  METHODOLOGY_SECTION_CHECK,
  FINDINGS_HAVE_EVIDENCE_CHECK,
  CANDIDATE_FINDINGS_RESOLVED_CHECK,
  PEER_REVIEW_APPROVED_CHECK,
  SECURITY_REVIEW_APPROVED_CHECK,
  IMPARTIALITY_DECLARED_CHECK,
  SAMPLING_PLAN_DOCUMENTED_CHECK,
  SIGNING_KEY_RECORDED_CHECK,
  TSA_ANCHOR_PRESENT_CHECK,
  READINESS_DISCLAIMER_CHECK,
];
