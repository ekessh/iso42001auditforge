// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ImmutableViolation, TenantViolation, ValidationError } from '@auditforge/shared';
import { createHarness } from './fixtures.js';

describe('EpisodeStore', () => {
  it('appends an episode and returns it with ingestionTime stamped from the clock', async () => {
    const h = createHarness('2030-02-15T10:00:00.000Z');
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
    expect(ep.id).toBeTruthy();
    expect(ep.ingestionTime).toBe('2030-02-15T10:00:00.000Z');
    expect(ep.body).toBe('We retrain monthly.');
  });

  it('rejects appends whose tenant does not match the context', async () => {
    const h = createHarness();
    await expect(
      h.episodeStore.append(h.ctx, {
        firmId: h.altCtx.firmId,
        engagementId: h.altCtx.engagementId,
        kind: 'system_event',
        sourceUtteranceId: null,
        speakerRole: 'system',
        body: '',
        attachments: [],
        parentEpisodeId: null,
      }),
    ).rejects.toBeInstanceOf(TenantViolation);
  });

  it('rejects mutation attempts (immutability)', async () => {
    const h = createHarness();
    await expect(h.episodeStore.update(h.ctx, 'anything')).rejects.toBeInstanceOf(
      ImmutableViolation,
    );
  });

  it('round-trips by id', async () => {
    const h = createHarness();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'interview_turn',
      sourceUtteranceId: null,
      speakerRole: 'auditor',
      body: 'How are models retrained?',
      attachments: [],
      parentEpisodeId: null,
    });
    const fetched = await h.episodeStore.get(h.ctx, ep.id);
    expect(fetched?.id).toBe(ep.id);
    expect(fetched?.kind).toBe('interview_turn');
  });

  it('blocks fetching an episode through a different engagement context', async () => {
    const h = createHarness();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'interview_turn',
      sourceUtteranceId: null,
      speakerRole: 'auditor',
      body: 'Q1',
      attachments: [],
      parentEpisodeId: null,
    });
    await expect(h.episodeStore.get(h.altCtx, ep.id)).rejects.toBeInstanceOf(
      TenantViolation,
    );
  });

  it('throws ValidationError for malformed input via validateOrThrow', () => {
    const h = createHarness();
    expect(() => h.episodeStore.validateOrThrow({})).toThrowError(ValidationError);
  });

  it('listForEngagement returns only that engagement\'s episodes', async () => {
    const h = createHarness();
    await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'A',
      attachments: [],
      parentEpisodeId: null,
    });
    await h.episodeStore.append(h.altCtx, {
      firmId: h.altCtx.firmId,
      engagementId: h.altCtx.engagementId,
      kind: 'auditee_answer',
      sourceUtteranceId: null,
      speakerRole: 'auditee',
      body: 'B',
      attachments: [],
      parentEpisodeId: null,
    });
    const list = await h.episodeStore.listForEngagement(h.ctx);
    expect(list.length).toBe(1);
    expect(list[0]?.body).toBe('A');
  });

  it('attaches files with sha256 + bytesize', async () => {
    const h = createHarness();
    const ep = await h.episodeStore.append(h.ctx, {
      firmId: h.ctx.firmId,
      engagementId: h.ctx.engagementId,
      kind: 'evidence_upload',
      sourceUtteranceId: null,
      speakerRole: null,
      body: 'incident-report',
      attachments: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          filename: 'ir.pdf',
          mimeType: 'application/pdf',
          sha256: 'a'.repeat(64),
          byteSize: 1024,
          storageRef: 's3://bucket/key',
        },
      ],
      parentEpisodeId: null,
    });
    expect(ep.attachments.length).toBe(1);
    expect(ep.attachments[0]?.sha256).toBe('a'.repeat(64));
  });
});
