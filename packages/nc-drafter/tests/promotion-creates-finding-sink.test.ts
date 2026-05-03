// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildPromotionDecision,
  mapPromotionToFindingInput,
  type CandidateFinding,
  type PromotionRequest,
} from '../src/index.js';

interface FindingsSinkCall {
  readonly input: ReturnType<typeof mapPromotionToFindingInput>;
  readonly newFindingId: string;
}

class FindingsSinkMock {
  readonly calls: FindingsSinkCall[] = [];
  async createFinding(
    input: ReturnType<typeof mapPromotionToFindingInput>,
  ): Promise<{ id: string }> {
    const id = randomUUID();
    this.calls.push({ input, newFindingId: id });
    return { id };
  }
}

const candidate: CandidateFinding = {
  id: '00000000-0000-4000-8000-000000000001',
  firmId: '00000000-0000-4000-8000-000000000aaa',
  engagementId: '00000000-0000-4000-8000-000000000bbb',
  type: 'minor_nc',
  draftStatement: 'Auditee did not produce evidence of monitoring.',
  linkedClauses: ['A.6.2.8'],
  linkedControls: [],
  sourceClaimIds: ['c1'],
  sourceEpisodeIds: ['ep1'],
  confidence: 0.7,
  suggestedRootCausePrompts: ['documentation_gap'],
  proposedSeverityRationale: 'closed block, no attribution',
  modelInvocationId: 'mi_zz',
  status: 'pending',
  createdAt: '2026-05-03T10:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  dismissalReason: null,
  detectorId: 'detector.evidence_absence.v1',
  promptTemplateVersion: 'nc_drafting.v1.0.0',
};

const request: PromotionRequest = {
  candidateFindingId: candidate.id,
  promotedBy: '00000000-0000-4000-8000-000000000ccc',
  promotedAt: '2026-05-03T11:00:00.000Z',
  overrides: {},
  auditEventId: '00000000-0000-4000-8000-000000000ddd',
  clientId: '00000000-0000-4000-8000-000000000eee',
};

describe('Promotion creates a v2 Finding (mocked sink)', () => {
  it('round-trips a candidate into the sink and yields a promotion decision', async () => {
    const sink = new FindingsSinkMock();
    const mapped = mapPromotionToFindingInput({
      candidate,
      request,
      evidenceIds: ['00000000-0000-4000-8000-000000000fff'],
      framework: 'ISO_42001',
    });
    const created = await sink.createFinding(mapped);
    expect(sink.calls).toHaveLength(1);
    expect(sink.calls[0]!.input.engagementId).toBe(candidate.engagementId);

    const decision = buildPromotionDecision({
      candidateFindingId: candidate.id,
      actor: request.promotedBy,
      at: request.promotedAt,
      promotedFindingId: created.id,
      idGen: () => randomUUID(),
    });
    expect(decision.action).toBe('promote');
    expect(decision.promotedFindingId).toBe(created.id);
  });
});
