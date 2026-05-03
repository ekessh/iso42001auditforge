// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MockExtractor, buildClaim, createHarness } from './fixtures.js';

describe('CompactionWorker', () => {
  it('persists schema-valid claims and writes an extraction invocation', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'We retrain monthly.',
      attachments: [],
      parentEpisodeId: null,
    });
    const claim = buildClaim(h.ctx, v, { subject: 'AISystem:credit' });
    const extractor = new MockExtractor({ claims: [claim] });
    const worker = h.buildCompactionWorker({ extractor });
    const result = await worker.compactEpisode(h.ctx, ep);
    expect(result.acceptedClaimIds.length).toBe(1);
    const invocations = await h.store.listExtractionInvocations(h.ctx);
    expect(invocations.length).toBe(1);
    expect(invocations[0]?.parsedClaimIds.length).toBe(1);
  });

  it('rejects claims whose entity type is not declared', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'b',
      attachments: [],
      parentEpisodeId: null,
    });
    const bad = buildClaim(h.ctx, v, { entityType: 'Alien' });
    const worker = h.buildCompactionWorker({ extractor: new MockExtractor({ claims: [bad] }) });
    const result = await worker.compactEpisode(h.ctx, ep);
    expect(result.acceptedClaimIds.length).toBe(0);
    expect(result.rejected[0]?.reason).toMatch(/unknown_entity_type/);
    const claims = await h.claimGraph.listClaims(h.ctx);
    expect(claims.length).toBe(0);
  });

  it('rejects claims whose predicate is not declared', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'b',
      attachments: [],
      parentEpisodeId: null,
    });
    const bad = buildClaim(h.ctx, v, { predicate: 'bogus_pred' });
    const worker = h.buildCompactionWorker({ extractor: new MockExtractor({ claims: [bad] }) });
    const result = await worker.compactEpisode(h.ctx, ep);
    expect(result.rejected[0]?.reason).toMatch(/unknown_relation_type/);
  });

  it('rejects claims whose tenant does not match', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'b',
      attachments: [],
      parentEpisodeId: null,
    });
    const wrongTenant = buildClaim(h.ctx, v, {
      firmId: '00000000-0000-4000-8000-000000000099',
    });
    const worker = h.buildCompactionWorker({
      extractor: new MockExtractor({ claims: [wrongTenant] }),
    });
    const result = await worker.compactEpisode(h.ctx, ep);
    expect(result.rejected[0]?.reason).toBe('tenant_mismatch');
  });

  it('passes through extractor-supplied rejections', async () => {
    const h = createHarness();
    await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'b',
      attachments: [],
      parentEpisodeId: null,
    });
    const worker = h.buildCompactionWorker({
      extractor: new MockExtractor({
        claims: [],
        rejections: [{ reason: 'malformed_json', raw: '{' }],
      }),
    });
    const result = await worker.compactEpisode(h.ctx, ep);
    expect(result.rejected[0]?.reason).toBe('malformed_json');
  });

  it('attaches the source episode to evidenceEpisodeIds when missing', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'b',
      attachments: [],
      parentEpisodeId: null,
    });
    const claim = buildClaim(h.ctx, v, { evidenceEpisodeIds: [] });
    const worker = h.buildCompactionWorker({ extractor: new MockExtractor({ claims: [claim] }) });
    const result = await worker.compactEpisode(h.ctx, ep);
    const stored = await h.claimGraph.getClaim(h.ctx, result.acceptedClaimIds[0]!);
    expect(stored?.evidenceEpisodeIds).toContain(ep.id);
  });

  it('archives source bodies older than archiveAfterDays', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const old = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'old body',
      attachments: [],
      parentEpisodeId: null,
    });
    h.clock.set('2030-12-01T00:00:00.000Z');
    const recent = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'recent',
      attachments: [],
      parentEpisodeId: null,
    });
    const worker = h.buildCompactionWorker({
      extractor: new MockExtractor({}),
      archiveAfterDays: 90,
    });
    const archived = await worker.archiveOldSources(h.ctx);
    expect(archived).toContain(old.id);
    expect(archived).not.toContain(recent.id);
    const fetched = await h.episodeStore.get(h.ctx, old.id);
    expect(fetched?.body).toBe('');
    expect(fetched?.archivedAt).toBeTruthy();
    void v;
  });

  it('does not double-archive episodes already archived', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    await h.freshSchema();
    await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'old',
      attachments: [],
      parentEpisodeId: null,
    });
    h.clock.set('2030-12-01T00:00:00.000Z');
    const worker = h.buildCompactionWorker({
      extractor: new MockExtractor({}),
      archiveAfterDays: 90,
    });
    const a1 = await worker.archiveOldSources(h.ctx);
    const a2 = await worker.archiveOldSources(h.ctx);
    expect(a1.length).toBe(1);
    expect(a2.length).toBe(0);
  });

  it('records modelInvocationId in the extraction invocation row', async () => {
    const h = createHarness();
    await h.freshSchema();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'b',
      attachments: [],
      parentEpisodeId: null,
    });
    const modelInvocationId = randomUUID();
    const worker = h.buildCompactionWorker({
      extractor: new MockExtractor({ modelInvocationId, claims: [] }),
    });
    await worker.compactEpisode(h.ctx, ep);
    const invocations = await h.store.listExtractionInvocations(h.ctx);
    expect(invocations[0]?.modelInvocationId).toBe(modelInvocationId);
  });
});
