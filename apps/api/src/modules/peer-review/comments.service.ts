// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PeerReviewCommentsService,
  type PeerReviewComment,
  type PeerReviewLedgerEvent,
  type PeerReviewRequest,
} from '@auditforge/peer-review';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import type { AddCommentDto, ResolveCommentDto } from './dto.js';
import { NotFoundError } from '../../common/errors.js';

/**
 * In-memory comment store. The Drizzle migration 0012 lays down the
 * `peer_review_comments` table; the persistence adapter swaps in there. For
 * unit / integration tests and pre-DB API smoke tests, this in-memory map
 * keeps the surface usable.
 *
 * Tenant isolation is enforced by partitioning by `firmId` in the map key.
 */
@Injectable()
export class PeerReviewCommentsApiService {
  private readonly store = new Map<string, PeerReviewComment[]>();
  private readonly inner: PeerReviewCommentsService;

  constructor(audit: AuditEngineAdapter) {
    this.inner = new PeerReviewCommentsService({
      emit: (event: PeerReviewLedgerEvent) => {
        const e = event as { kind: string; requestId?: string; actorId?: string };
        // Fire-and-forget; rejection from concurrent appends is logged
        // internally by AuditEngineAdapter. Persistence guarantees come
        // from migration 0012 (peer_review_comments).
        void audit
          .append({
            firmId: 'unknown',
            actorId: typeof e.actorId === 'string' ? e.actorId : 'system',
            type: e.kind,
            entity: 'peer-review-comment',
            entityId: typeof e.requestId === 'string' ? e.requestId : 'unknown',
            payload: event as unknown as Record<string, unknown>,
          })
          .catch(() => undefined);
      },
    });
  }

  list(firmId: string, packageId: string): PeerReviewComment[] {
    return (this.store.get(this.key(firmId, packageId)) ?? []).slice();
  }

  add(args: {
    firmId: string;
    request: PeerReviewRequest;
    actorId: string;
    dto: AddCommentDto;
  }): PeerReviewComment {
    const existing = this.list(args.firmId, args.request.id);
    const comment = this.inner.add({
      request: args.request,
      existing,
      commentId: randomUUID(),
      parentId: args.dto.parentId,
      authorId: args.actorId,
      scope: args.dto.scope,
      body: args.dto.body,
      flag: args.dto.flag,
      tenant: { firmId: args.firmId, engagementId: args.request.engagementId },
    });
    const list = this.store.get(this.key(args.firmId, args.request.id)) ?? [];
    list.push(comment);
    this.store.set(this.key(args.firmId, args.request.id), list);
    return comment;
  }

  resolve(args: {
    firmId: string;
    request: PeerReviewRequest;
    commentId: string;
    actorId: string;
    dto: ResolveCommentDto;
  }): PeerReviewComment {
    const list = this.store.get(this.key(args.firmId, args.request.id)) ?? [];
    const idx = list.findIndex((c) => c.id === args.commentId);
    if (idx === -1) throw new NotFoundError('PeerReviewComment', args.commentId);
    const before = list[idx]!;
    const after = this.inner.resolve({
      request: args.request,
      comment: before,
      resolverId: args.actorId,
      resolutionNote: args.dto.resolutionNote,
      tenant: { firmId: args.firmId, engagementId: args.request.engagementId },
    });
    list[idx] = after;
    this.store.set(this.key(args.firmId, args.request.id), list);
    return after;
  }

  private key(firmId: string, packageId: string): string {
    return `${firmId}::${packageId}`;
  }
}
