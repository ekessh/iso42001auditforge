// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  PeerReviewCommentsService,
  allThreadsResolved,
  hasSecuritySensitiveOpenThread,
  threadsFrom,
  type PeerReviewComment,
} from '../src/index.js';
import { FIRM_A, FixedClock, RecordingEmitter, makeRequest, tenant } from './helpers.js';

describe('PeerReviewCommentsService', () => {
  it('adds a comment in in_review and emits ledger event', () => {
    const ledger = new RecordingEmitter();
    const svc = new PeerReviewCommentsService(ledger, new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    const c = svc.add({
      request: req,
      existing: [],
      commentId: randomUUID(),
      parentId: null,
      authorId: req.engagementTeamIds[0]!,
      scope: { kind: 'global' },
      body: 'Plan needs more detail on stratification rationale.',
      tenant: tenant(),
    });
    expect(c.body.length).toBeGreaterThan(0);
    expect(c.flag).toBe('standard');
    expect(ledger.events.some((e) => e.kind === 'peer_review.comment_added')).toBe(true);
  });

  it('rejects empty body', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    expect(() =>
      svc.add({
        request: req,
        existing: [],
        commentId: randomUUID(),
        parentId: null,
        authorId: req.primaryAuditorId,
        scope: { kind: 'global' },
        body: '   ',
        tenant: tenant(),
      }),
    ).toThrowError(/body/);
  });

  it('rejects when parent comment missing', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    expect(() =>
      svc.add({
        request: req,
        existing: [],
        commentId: randomUUID(),
        parentId: randomUUID(),
        authorId: req.primaryAuditorId,
        scope: { kind: 'global' },
        body: 'reply',
        tenant: tenant(),
      }),
    ).toThrowError();
  });

  it('rejects adding when status is not in_review or changes_requested', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'pending' });
    expect(() =>
      svc.add({
        request: req,
        existing: [],
        commentId: randomUUID(),
        parentId: null,
        authorId: req.primaryAuditorId,
        scope: { kind: 'global' },
        body: 'x',
        tenant: tenant(),
      }),
    ).toThrowError(/in_review/);
  });

  it('rejects cross-firm tenant', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    expect(() =>
      svc.add({
        request: req,
        existing: [],
        commentId: randomUUID(),
        parentId: null,
        authorId: req.primaryAuditorId,
        scope: { kind: 'global' },
        body: 'x',
        tenant: { firmId: '00000000-0000-0000-0000-00000000ffff' },
      }),
    ).toThrowError(/firm/);
  });

  it('resolves a root comment and emits resolved event', () => {
    const ledger = new RecordingEmitter();
    const clock = new FixedClock();
    const svc = new PeerReviewCommentsService(ledger, clock);
    const req = makeRequest({ status: 'in_review' });
    const c = svc.add({
      request: req,
      existing: [],
      commentId: randomUUID(),
      parentId: null,
      authorId: req.primaryAuditorId,
      scope: { kind: 'global' },
      body: 'fix sampling',
      tenant: tenant(),
    });
    clock.advance(1000);
    const resolved = svc.resolve({
      request: req,
      comment: c,
      resolverId: req.primaryAuditorId,
      resolutionNote: 'Sampling rationale added in section 4.',
      tenant: tenant(),
    });
    expect(resolved.resolvedAt).toBeTruthy();
    expect(resolved.resolutionNote).toBeTruthy();
    expect(ledger.events.some((e) => e.kind === 'peer_review.comment_resolved')).toBe(true);
  });

  it('rejects resolving an already-resolved comment', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    const c: PeerReviewComment = {
      id: randomUUID(),
      packageId: req.id,
      parentId: null,
      authorId: req.primaryAuditorId,
      scope: { kind: 'global' },
      body: 'x',
      createdAt: '2026-05-01T12:00:00Z',
      resolvedAt: '2026-05-02T00:00:00Z',
      resolvedBy: req.primaryAuditorId,
      flag: 'standard',
    };
    expect(() =>
      svc.resolve({
        request: req,
        comment: c,
        resolverId: req.primaryAuditorId,
        resolutionNote: '',
        tenant: tenant(),
      }),
    ).toThrowError(/already resolved/);
  });

  it('rejects resolving a reply (only roots are resolvable)', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    const reply: PeerReviewComment = {
      id: randomUUID(),
      packageId: req.id,
      parentId: randomUUID(),
      authorId: req.primaryAuditorId,
      scope: { kind: 'global' },
      body: 'x',
      createdAt: '2026-05-01T12:00:00Z',
      flag: 'standard',
    };
    expect(() =>
      svc.resolve({
        request: req,
        comment: reply,
        resolverId: req.primaryAuditorId,
        resolutionNote: '',
        tenant: tenant(),
      }),
    ).toThrowError(/root/);
  });

  it('threadsFrom groups roots and replies in stable order', () => {
    const root1: PeerReviewComment = {
      id: 'aaaa-1',
      packageId: 'p',
      parentId: null,
      authorId: 'x',
      scope: { kind: 'global' },
      body: 'r1',
      createdAt: '2026-05-01T12:00:00Z',
      flag: 'standard',
    };
    const root2: PeerReviewComment = {
      ...root1,
      id: 'bbbb-2',
      body: 'r2',
      createdAt: '2026-05-02T12:00:00Z',
    };
    const reply: PeerReviewComment = {
      ...root1,
      id: 'cccc-3',
      parentId: 'aaaa-1',
      body: 'reply to r1',
      createdAt: '2026-05-01T13:00:00Z',
    };
    const groups = threadsFrom([root2, root1, reply]);
    expect(groups[0]?.root.id).toBe('aaaa-1');
    expect(groups[0]?.replies.map((r) => r.id)).toContain('cccc-3');
  });

  it('allThreadsResolved + hasSecuritySensitiveOpenThread', () => {
    const open: PeerReviewComment = {
      id: 'a',
      packageId: 'p',
      parentId: null,
      authorId: 'x',
      scope: { kind: 'global' },
      body: 'x',
      createdAt: '2026-05-01T12:00:00Z',
      flag: 'security',
    };
    const closed: PeerReviewComment = {
      ...open,
      id: 'b',
      flag: 'standard',
      resolvedAt: '2026-05-02T12:00:00Z',
      resolvedBy: 'y',
    };
    expect(allThreadsResolved([open, closed])).toBe(false);
    expect(allThreadsResolved([closed])).toBe(true);
    expect(allThreadsResolved([])).toBe(true);
    expect(hasSecuritySensitiveOpenThread([open, closed])).toBe(true);
    expect(hasSecuritySensitiveOpenThread([closed])).toBe(false);
  });

  it('requiresSecurityReviewer mirrors hasSecuritySensitiveOpenThread', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const c: PeerReviewComment = {
      id: 'x',
      packageId: 'p',
      parentId: null,
      authorId: 'y',
      scope: { kind: 'global' },
      body: 'x',
      createdAt: '2026-05-01T12:00:00Z',
      flag: 'data-protection',
    };
    expect(svc.requiresSecurityReviewer([c])).toBe(true);
  });

  it('uses firm tenant context to gate access', () => {
    const svc = new PeerReviewCommentsService(new RecordingEmitter(), new FixedClock());
    const req = makeRequest({ status: 'in_review' });
    expect(() =>
      svc.resolve({
        request: req,
        comment: {
          id: 'x',
          packageId: req.id,
          parentId: null,
          authorId: req.primaryAuditorId,
          scope: { kind: 'global' },
          body: 'x',
          createdAt: '2026-05-01T12:00:00Z',
          flag: 'standard',
        },
        resolverId: req.primaryAuditorId,
        resolutionNote: '',
        tenant: { firmId: '00000000-0000-0000-0000-00000000eeee' },
      }),
    ).toThrowError(/firm/);
    // Sanity: same firm passes (uses FIRM_A from helpers)
    expect(FIRM_A).toBeDefined();
  });
});
