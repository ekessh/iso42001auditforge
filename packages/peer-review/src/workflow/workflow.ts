// SPDX-License-Identifier: BUSL-1.1
import {
  ConflictError,
  NotFoundError,
  TenantViolation,
  ValidationError,
  type TenantContext,
} from '@auditforge/shared';
import type {
  IndependencePolicy,
  ReviewerRecord,
} from '../domain/independence.js';
import type { PeerReviewLedgerEvent } from '../domain/events.js';
import type {
  PeerReviewRequest,
  PeerReviewResponse,
  PeerReviewSignOff,
} from '../domain/request.js';
import type { PeerReviewChecklist } from '../domain/checklist.js';
import type { ItemResponse } from '../domain/enums.js';
import { InvariantsChecker } from '../invariants/independence.js';
import { canPerform, isTerminal, nextStatus } from './state-machine.js';
import { QualityScoring } from '../scoring/quality-scoring.js';

/**
 * Outbound port — the workflow never talks to the ledger directly. The
 * `apps/api` adapter signs and persists.
 */
export interface LedgerEmitter {
  emit(event: PeerReviewLedgerEvent): void;
}

/** Minimal clock port — defaults to system clock. */
export interface Clock {
  now(): string;
}

const SYSTEM_CLOCK: Clock = {
  now: () => new Date().toISOString(),
};

/**
 * `PeerReviewWorkflow` is a pure orchestrator. It does not store anything;
 * each method takes the current aggregate, returns a *new* aggregate, and
 * emits ledger events through the injected `LedgerEmitter`.
 *
 * The caller (apps/api) wraps these operations in a DB transaction and
 * persists the returned request after the emitter has been called.
 */
export class PeerReviewWorkflow {
  constructor(
    private readonly ledger: LedgerEmitter,
    private readonly clock: Clock = SYSTEM_CLOCK,
  ) {}

  /**
   * Create a brand-new request in `pending` status. No reviewer assigned yet.
   */
  create(args: {
    request: Omit<
      PeerReviewRequest,
      | 'status'
      | 'responses'
      | 'createdAt'
      | 'updatedAt'
      | 'reviewerId'
      | 'assignedAt'
      | 'closedAt'
      | 'revisionCount'
      | 'signOff'
    >;
    actorId: string;
  }): PeerReviewRequest {
    const now = this.clock.now();
    const request: PeerReviewRequest = {
      ...args.request,
      status: 'pending',
      responses: [],
      createdAt: now,
      updatedAt: now,
      revisionCount: 0,
    };
    this.ledger.emit({
      kind: 'peer_review.created',
      requestId: request.id,
      firmId: request.firmId,
      engagementId: request.engagementId,
      actorId: args.actorId,
      at: now,
    });
    return request;
  }

  /**
   * Assign a reviewer. Performs all independence checks and transitions
   * `pending -> in_review`.
   */
  assign(args: {
    request: PeerReviewRequest;
    candidate: ReviewerRecord;
    policy: IndependencePolicy;
    tenant: TenantContext;
    actorId: string;
  }): PeerReviewRequest {
    this.assertTenant(args.request, args.tenant);
    if (!canPerform(args.request.status, 'assign')) {
      // Throws StateMachineError via nextStatus
      nextStatus(args.request.status, 'assign');
    }
    if (args.policy.firmId !== args.request.firmId) {
      throw new ValidationError(
        'Independence policy applies to a different firm',
        { policyFirmId: args.policy.firmId, requestFirmId: args.request.firmId },
      );
    }
    InvariantsChecker.require({
      firmId: args.request.firmId,
      primaryAuditorId: args.request.primaryAuditorId,
      engagementTeamIds: args.request.engagementTeamIds,
      candidate: args.candidate,
      policy: args.policy,
    });

    const now = this.clock.now();
    const updated: PeerReviewRequest = {
      ...args.request,
      reviewerId: args.candidate.auditorId,
      status: nextStatus(args.request.status, 'assign'),
      assignedAt: now,
      updatedAt: now,
    };
    this.ledger.emit({
      kind: 'peer_review.assigned',
      requestId: updated.id,
      reviewerId: args.candidate.auditorId,
      actorId: args.actorId,
      at: now,
    });
    this.ledger.emit({
      kind: 'peer_review.status_transition',
      requestId: updated.id,
      from: args.request.status,
      to: updated.status,
      actorId: args.actorId,
      at: now,
    });
    return updated;
  }

  /**
   * Capture (or replace) a single response. Allowed only in `in_review`.
   * Validates the item exists in the bound checklist and that the response
   * conforms to NA / comment rules (`fail` requires a comment).
   */
  recordResponse(args: {
    request: PeerReviewRequest;
    checklist: PeerReviewChecklist;
    itemId: string;
    response: ItemResponse;
    comment: string;
    tenant: TenantContext;
    actorId: string;
  }): PeerReviewRequest {
    this.assertTenant(args.request, args.tenant);
    if (args.request.status !== 'in_review') {
      throw new ConflictError(
        `Cannot record responses outside in_review (current: ${args.request.status})`,
        { status: args.request.status },
      );
    }
    if (
      args.checklist.id !== args.request.checklistId ||
      args.checklist.version !== args.request.checklistVersion
    ) {
      throw new ValidationError('Checklist binding mismatch', {
        expected: `${args.request.checklistId}@${args.request.checklistVersion}`,
        got: `${args.checklist.id}@${args.checklist.version}`,
      });
    }
    const item = args.checklist.items.find((i) => i.id === args.itemId);
    if (!item) throw new NotFoundError('Checklist item', args.itemId);
    if (args.response === 'na' && !item.naAllowed) {
      throw new ValidationError('NA not allowed on this item', { itemId: args.itemId });
    }
    if (args.response === 'fail' && args.comment.trim().length === 0) {
      throw new ValidationError('Fail response requires a comment', {
        itemId: args.itemId,
      });
    }
    if (args.actorId !== args.request.reviewerId) {
      throw new ValidationError('Only the assigned reviewer may answer', {
        actorId: args.actorId,
        reviewerId: args.request.reviewerId,
      });
    }

    const now = this.clock.now();
    const newResponse: PeerReviewResponse = {
      itemId: args.itemId,
      response: args.response,
      comment: args.comment,
      answeredAt: now,
    };
    const responses = args.request.responses.filter((r) => r.itemId !== args.itemId);
    responses.push(newResponse);

    const updated: PeerReviewRequest = {
      ...args.request,
      responses,
      updatedAt: now,
    };
    this.ledger.emit({
      kind: 'peer_review.response_recorded',
      requestId: updated.id,
      itemId: args.itemId,
      response: args.response,
      actorId: args.actorId,
      at: now,
    });
    return updated;
  }

  /**
   * Reviewer completes review with `verdict='request-changes'`. Transitions
   * `in_review -> changes_requested`. Comments on failed items are required
   * and must already be present (record-time validation).
   */
  requestChanges(args: {
    request: PeerReviewRequest;
    summary: string;
    signature: string;
    tenant: TenantContext;
    actorId: string;
  }): PeerReviewRequest {
    this.assertTenant(args.request, args.tenant);
    const to = nextStatus(args.request.status, 'request_changes');
    if (args.actorId !== args.request.reviewerId) {
      throw new ValidationError('Only the assigned reviewer may request changes', {
        actorId: args.actorId,
        reviewerId: args.request.reviewerId,
      });
    }
    if (args.summary.trim().length === 0) {
      throw new ValidationError('request-changes requires a summary', {});
    }
    const now = this.clock.now();
    const signOff: PeerReviewSignOff = {
      verdict: 'request-changes',
      reviewerId: args.actorId,
      signedAt: now,
      signature: args.signature,
      summary: args.summary,
    };
    const updated: PeerReviewRequest = {
      ...args.request,
      status: to,
      signOff,
      updatedAt: now,
      revisionCount: args.request.revisionCount + 1,
    };
    this.ledger.emit({
      kind: 'peer_review.changes_requested',
      requestId: updated.id,
      revisionCount: updated.revisionCount,
      actorId: args.actorId,
      at: now,
    });
    this.ledger.emit({
      kind: 'peer_review.signed_off',
      requestId: updated.id,
      verdict: 'request-changes',
      actorId: args.actorId,
      at: now,
    });
    this.ledger.emit({
      kind: 'peer_review.status_transition',
      requestId: updated.id,
      from: args.request.status,
      to,
      actorId: args.actorId,
      at: now,
    });
    return updated;
  }

  /**
   * Auditor (NOT the reviewer) resubmits after addressing changes; reverts
   * `changes_requested -> in_review`. Clears the prior sign-off so the
   * reviewer must re-finalize.
   */
  resubmit(args: {
    request: PeerReviewRequest;
    tenant: TenantContext;
    actorId: string;
  }): PeerReviewRequest {
    this.assertTenant(args.request, args.tenant);
    const to = nextStatus(args.request.status, 'resubmit');
    // The auditor under review (primaryAuditorId) is the only valid actor;
    // the reviewer may NOT self-resubmit (separation of duties).
    if (args.actorId === args.request.reviewerId) {
      throw new ValidationError('Reviewer cannot resubmit on auditor’s behalf', {
        actorId: args.actorId,
      });
    }
    if (args.actorId !== args.request.primaryAuditorId) {
      throw new ValidationError(
        'Only the primary auditor may resubmit for re-review',
        { actorId: args.actorId, primaryAuditorId: args.request.primaryAuditorId },
      );
    }
    const now = this.clock.now();
    const updated: PeerReviewRequest = {
      ...args.request,
      status: to,
      signOff: undefined,
      updatedAt: now,
    };
    this.ledger.emit({
      kind: 'peer_review.resubmitted',
      requestId: updated.id,
      actorId: args.actorId,
      at: now,
    });
    this.ledger.emit({
      kind: 'peer_review.status_transition',
      requestId: updated.id,
      from: args.request.status,
      to,
      actorId: args.actorId,
      at: now,
    });
    return updated;
  }

  /**
   * Reviewer approves. Transitions `in_review -> approved` (terminal).
   * - Every non-NA item must have a response (full-coverage rule).
   * - Any `blockingOnFail` item with response `fail` requires a non-empty
   *   override summary.
   */
  approve(args: {
    request: PeerReviewRequest;
    checklist: PeerReviewChecklist;
    summary: string;
    signature: string;
    tenant: TenantContext;
    actorId: string;
  }): PeerReviewRequest {
    this.assertTenant(args.request, args.tenant);
    const to = nextStatus(args.request.status, 'approve');
    if (args.actorId !== args.request.reviewerId) {
      throw new ValidationError('Only the assigned reviewer may approve', {
        actorId: args.actorId,
        reviewerId: args.request.reviewerId,
      });
    }
    // Coverage check.
    const responseIds = new Set(args.request.responses.map((r) => r.itemId));
    const missing = args.checklist.items
      .filter((i) => !responseIds.has(i.id))
      .map((i) => i.id);
    if (missing.length > 0) {
      throw new ValidationError('All checklist items must have a response', {
        missing,
      });
    }
    if (
      QualityScoring.hasBlockingFailures(args.request, args.checklist) &&
      args.summary.trim().length === 0
    ) {
      throw new ValidationError(
        'Blocking-fail items require an override summary on approve',
        {},
      );
    }

    const now = this.clock.now();
    const signOff: PeerReviewSignOff = {
      verdict: 'approve',
      reviewerId: args.actorId,
      signedAt: now,
      signature: args.signature,
      summary: args.summary,
    };
    const updated: PeerReviewRequest = {
      ...args.request,
      status: to,
      signOff,
      updatedAt: now,
      closedAt: now,
    };
    this.ledger.emit({
      kind: 'peer_review.signed_off',
      requestId: updated.id,
      verdict: 'approve',
      actorId: args.actorId,
      at: now,
    });
    this.ledger.emit({
      kind: 'peer_review.status_transition',
      requestId: updated.id,
      from: args.request.status,
      to,
      actorId: args.actorId,
      at: now,
    });
    return updated;
  }

  /**
   * Withdraw a request — terminal. Allowed from `pending`, `in_review`,
   * `changes_requested`. Generally used when the engagement gets cancelled
   * pre-issuance.
   */
  withdraw(args: {
    request: PeerReviewRequest;
    reason: string;
    tenant: TenantContext;
    actorId: string;
  }): PeerReviewRequest {
    this.assertTenant(args.request, args.tenant);
    const to = nextStatus(args.request.status, 'withdraw');
    if (args.reason.trim().length === 0) {
      throw new ValidationError('withdraw requires a reason', {});
    }
    if (isTerminal(args.request.status)) {
      throw new ConflictError('Already terminal', { status: args.request.status });
    }
    const now = this.clock.now();
    const updated: PeerReviewRequest = {
      ...args.request,
      status: to,
      updatedAt: now,
      closedAt: now,
    };
    this.ledger.emit({
      kind: 'peer_review.withdrawn',
      requestId: updated.id,
      actorId: args.actorId,
      at: now,
    });
    this.ledger.emit({
      kind: 'peer_review.status_transition',
      requestId: updated.id,
      from: args.request.status,
      to,
      actorId: args.actorId,
      at: now,
    });
    return updated;
  }

  private assertTenant(request: PeerReviewRequest, tenant: TenantContext): void {
    if (request.firmId !== tenant.firmId) {
      throw new TenantViolation('Peer review belongs to another firm', {
        requestFirmId: request.firmId,
        callerFirmId: tenant.firmId,
      });
    }
    if (tenant.engagementId && tenant.engagementId !== request.engagementId) {
      throw new TenantViolation('Peer review belongs to another engagement', {
        requestEngagementId: request.engagementId,
        callerEngagementId: tenant.engagementId,
      });
    }
  }
}
