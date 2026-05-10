// SPDX-License-Identifier: BUSL-1.1
import {
  ConflictError,
  NotFoundError,
  TenantViolation,
  ValidationError,
  type TenantContext,
} from '@auditforge/shared';
import type {
  PeerReviewComment,
  PeerReviewCommentScope,
} from '../domain/comments.js';
import { hasSecuritySensitiveOpenThread } from '../domain/comments.js';
import type { PeerReviewRequest } from '../domain/request.js';
import type { Clock, LedgerEmitter } from './workflow.js';

const SYSTEM_CLOCK: Clock = { now: () => new Date().toISOString() };

/**
 * PeerReviewCommentsService — pure orchestrator for the comment-thread
 * surface that lives alongside the workflow state machine. Persistence is
 * the caller's responsibility; the service emits ledger events through the
 * supplied emitter.
 *
 * Tenant scoping: every operation takes the current TenantContext and
 * verifies the request belongs to the same firm/engagement.
 */
export class PeerReviewCommentsService {
  constructor(
    private readonly ledger: LedgerEmitter,
    private readonly clock: Clock = SYSTEM_CLOCK,
  ) {}

  add(args: {
    request: PeerReviewRequest;
    existing: readonly PeerReviewComment[];
    commentId: string;
    parentId: string | null;
    authorId: string;
    scope: PeerReviewCommentScope;
    body: string;
    flag?: PeerReviewComment['flag'];
    tenant: TenantContext;
  }): PeerReviewComment {
    this.assertTenant(args.request, args.tenant);
    if (args.body.trim().length === 0) {
      throw new ValidationError('Comment body cannot be empty', {});
    }
    if (args.parentId !== null) {
      const parent = args.existing.find((c) => c.id === args.parentId);
      if (!parent) {
        throw new NotFoundError('Parent comment', args.parentId);
      }
    }
    const allowedStatuses = new Set([
      'in_review',
      'changes_requested',
    ]);
    if (!allowedStatuses.has(args.request.status)) {
      throw new ConflictError(
        `Comments can only be added in in_review or changes_requested (current: ${args.request.status})`,
        { status: args.request.status },
      );
    }
    const at = this.clock.now();
    const comment: PeerReviewComment = {
      id: args.commentId,
      packageId: args.request.id,
      parentId: args.parentId,
      authorId: args.authorId,
      scope: args.scope,
      body: args.body,
      createdAt: at,
      flag: args.flag ?? 'standard',
    };
    this.ledger.emit({
      kind: 'peer_review.comment_added',
      requestId: args.request.id,
      commentId: comment.id,
      flag: comment.flag,
      actorId: args.authorId,
      at,
    });
    return comment;
  }

  resolve(args: {
    request: PeerReviewRequest;
    comment: PeerReviewComment;
    resolverId: string;
    resolutionNote: string;
    tenant: TenantContext;
  }): PeerReviewComment {
    this.assertTenant(args.request, args.tenant);
    if (args.comment.resolvedAt) {
      throw new ConflictError('Comment already resolved', { commentId: args.comment.id });
    }
    if (args.comment.parentId !== null) {
      throw new ValidationError('Only root comments can be resolved', {
        commentId: args.comment.id,
      });
    }
    const at = this.clock.now();
    const resolved: PeerReviewComment = {
      ...args.comment,
      resolvedAt: at,
      resolvedBy: args.resolverId,
      ...(args.resolutionNote.trim().length > 0
        ? { resolutionNote: args.resolutionNote }
        : {}),
    };
    this.ledger.emit({
      kind: 'peer_review.comment_resolved',
      requestId: args.request.id,
      commentId: resolved.id,
      actorId: args.resolverId,
      at,
    });
    return resolved;
  }

  /** Returns true iff the package has any open security/data-protection comment. */
  requiresSecurityReviewer(comments: readonly PeerReviewComment[]): boolean {
    return hasSecuritySensitiveOpenThread(comments);
  }

  private assertTenant(req: PeerReviewRequest, tenant: TenantContext): void {
    if (req.firmId !== tenant.firmId) {
      throw new TenantViolation('Peer review belongs to another firm', {
        requestFirmId: req.firmId,
        callerFirmId: tenant.firmId,
      });
    }
    if (tenant.engagementId && tenant.engagementId !== req.engagementId) {
      throw new TenantViolation('Peer review belongs to another engagement', {
        requestEngagementId: req.engagementId,
        callerEngagementId: tenant.engagementId,
      });
    }
  }
}
