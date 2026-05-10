// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import { WorkingPapersSyncService } from './working-papers-sync.service.js';

function makeService(): {
  service: WorkingPapersSyncService;
  loadEngagementForWp: ReturnType<typeof vi.fn>;
  appendUpdate: ReturnType<typeof vi.fn>;
  upsertSnapshot: ReturnType<typeof vi.fn>;
  audit: { append: ReturnType<typeof vi.fn> };
} {
  const repo = {
    loadEngagementForWp: vi.fn(async (_firmId: string, wpId: string) =>
      wpId === 'wp-known' ? { engagementId: 'eng-1' } : null,
    ),
    loadSnapshot: vi.fn(async () => null),
    loadUpdatesAfter: vi.fn(async () => []),
    appendUpdate: vi.fn(async () => undefined),
    upsertSnapshot: vi.fn(async () => undefined),
    deleteUpdatesBefore: vi.fn(async () => 0),
  };
  const audit = { append: vi.fn(async () => undefined) };
  const service = new WorkingPapersSyncService(
    repo as unknown as ConstructorParameters<typeof WorkingPapersSyncService>[0],
    audit as unknown as ConstructorParameters<typeof WorkingPapersSyncService>[1],
  );
  return {
    service,
    loadEngagementForWp: repo.loadEngagementForWp,
    appendUpdate: repo.appendUpdate,
    upsertSnapshot: repo.upsertSnapshot,
    audit,
  };
}

describe('WorkingPapersSyncService.authorize', () => {
  it('rejects when caller lacks working_paper.update', async () => {
    const { service } = makeService();
    const decision = await service.authorize({
      firmId: 'f',
      auditorId: 'a',
      workingPaperId: 'wp-known',
      canWrite: false,
    });
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.code).toBe(4403);
  });

  it('rejects when working paper does not exist in firm', async () => {
    const { service } = makeService();
    const decision = await service.authorize({
      firmId: 'f',
      auditorId: 'a',
      workingPaperId: 'wp-unknown',
      canWrite: true,
    });
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.code).toBe(4404);
  });

  it('grants when WP belongs to firm and caller can write', async () => {
    const { service } = makeService();
    const decision = await service.authorize({
      firmId: 'f',
      auditorId: 'a',
      workingPaperId: 'wp-known',
      canWrite: true,
    });
    expect(decision.allow).toBe(true);
    if (decision.allow) expect(decision.auditor.engagementId).toBe('eng-1');
  });
});

describe('WorkingPapersSyncService.ingestUpdate', () => {
  it('persists each update and tracks participants per room', async () => {
    const { service, appendUpdate } = makeService();
    await service.ensureRoom({
      firmId: 'f',
      engagementId: 'eng-1',
      workingPaperId: 'wp-known',
    });
    service.trackParticipant('wp-known', 'sess-1');
    expect(service.participantCount('wp-known')).toBe(1);
    // Build a tiny Y.js update: an empty update is still legitimately bytes.
    const Y = await import('yjs');
    const doc = new Y.Doc();
    doc.getMap('m').set('k', 'v');
    const update = Y.encodeStateAsUpdateV2(doc);
    const result = await service.ingestUpdate({
      workingPaperId: 'wp-known',
      update,
      auditorId: 'a',
    });
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(appendUpdate).toHaveBeenCalledOnce();
    service.untrackParticipant('wp-known', 'sess-1');
    expect(service.participantCount('wp-known')).toBe(0);
  });
});
