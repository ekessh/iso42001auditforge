// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  mapCandidateType,
  mapPromotionToFindingInput,
  riskRatingForType,
  severityForType,
  type CandidateFinding,
  type PromotionRequest,
} from '../src/index.js';

const candidate: CandidateFinding = {
  id: '00000000-0000-4000-8000-000000000001',
  firmId: '00000000-0000-4000-8000-000000000aaa',
  engagementId: '00000000-0000-4000-8000-000000000bbb',
  type: 'major_nc',
  draftStatement: 'Auditee did not perform AI risk assessment...',
  linkedClauses: ['6.1.2'],
  linkedControls: ['CTRL.6.1.2'],
  sourceClaimIds: ['c1', 'c2'],
  sourceEpisodeIds: ['ep1', 'ep2'],
  confidence: 0.92,
  suggestedRootCausePrompts: ['process_design'],
  proposedSeverityRationale: 'mandatory main-body high-severity',
  modelInvocationId: 'mi_x',
  status: 'pending',
  createdAt: '2026-05-03T10:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  dismissalReason: null,
  detectorId: 'detector.direct_conformity_gap.v1',
  promptTemplateVersion: 'nc_drafting.v1.0.0',
};

const baseRequest: PromotionRequest = {
  candidateFindingId: candidate.id,
  promotedBy: '00000000-0000-4000-8000-000000000ccc',
  promotedAt: '2026-05-03T11:00:00.000Z',
  overrides: {},
  auditEventId: '00000000-0000-4000-8000-000000000ddd',
  clientId: '00000000-0000-4000-8000-000000000eee',
};

describe('mapCandidateType', () => {
  it('collapses observation to ofi', () => {
    expect(mapCandidateType('observation')).toBe('ofi');
  });
  it('preserves canonical types', () => {
    expect(mapCandidateType('major_nc')).toBe('major_nc');
    expect(mapCandidateType('minor_nc')).toBe('minor_nc');
    expect(mapCandidateType('ofi')).toBe('ofi');
  });
});

describe('severityForType / riskRatingForType', () => {
  it('maps severities correctly', () => {
    expect(severityForType('major_nc')).toBe('high');
    expect(severityForType('minor_nc')).toBe('medium');
    expect(severityForType('ofi')).toBe('low');
  });
  it('maps risk ratings within 1..5', () => {
    expect(riskRatingForType('major_nc')).toBe(4);
    expect(riskRatingForType('minor_nc')).toBe(2);
    expect(riskRatingForType('ofi')).toBe(1);
  });
});

describe('mapPromotionToFindingInput', () => {
  it('produces a v2 finding-input mapping with clauseLinks for the framework', () => {
    const out = mapPromotionToFindingInput({
      candidate,
      request: baseRequest,
      evidenceIds: ['00000000-0000-4000-8000-000000000111'],
      framework: 'ISO_42001',
    });
    expect(out.type).toBe('major_nc');
    expect(out.severity).toBe('high');
    expect(out.riskRating).toBe(4);
    expect(out.clauseLinks).toEqual([
      { framework: 'ISO_42001', clauseId: '6.1.2' },
    ]);
    expect(out.controlLinks).toEqual([{ controlId: 'CTRL.6.1.2' }]);
    expect(out.evidenceLinks).toEqual([
      { evidenceId: '00000000-0000-4000-8000-000000000111' },
    ]);
    expect(out.statementText).toBe(candidate.draftStatement);
    expect(out.topicTags).toContain(candidate.detectorId);
    expect(out.topicTags.some((t) => t.startsWith('from_candidate:'))).toBe(true);
  });

  it('applies overrides when supplied', () => {
    const out = mapPromotionToFindingInput({
      candidate,
      request: {
        ...baseRequest,
        overrides: {
          type: 'minor_nc',
          draftStatement: 'Refined statement.',
          linkedClauses: ['7.2'],
          linkedControls: [],
          rootCausePromptResponse: 'Reviewed by lead auditor.',
        },
      },
      evidenceIds: [],
      framework: 'ISO_42001',
    });
    expect(out.type).toBe('minor_nc');
    expect(out.severity).toBe('medium');
    expect(out.statementText).toBe('Refined statement.');
    expect(out.clauseLinks).toEqual([{ framework: 'ISO_42001', clauseId: '7.2' }]);
    expect(out.controlLinks).toEqual([]);
    expect(out.rootCausePromptResponse).toBe('Reviewed by lead auditor.');
  });

  it('rejects when candidate ID does not match request ID', () => {
    expect(() =>
      mapPromotionToFindingInput({
        candidate,
        request: {
          ...baseRequest,
          candidateFindingId: '00000000-0000-4000-8000-999999999999',
        },
        evidenceIds: [],
        framework: 'ISO_42001',
      }),
    ).toThrow(/does not match/);
  });

  it('refuses to promote a dismissed candidate', () => {
    expect(() =>
      mapPromotionToFindingInput({
        candidate: { ...candidate, status: 'dismissed' },
        request: baseRequest,
        evidenceIds: [],
        framework: 'ISO_42001',
      }),
    ).toThrow(/dismissed/);
  });

  it('refuses to promote an already-promoted candidate', () => {
    expect(() =>
      mapPromotionToFindingInput({
        candidate: { ...candidate, status: 'promoted' },
        request: baseRequest,
        evidenceIds: [],
        framework: 'ISO_42001',
      }),
    ).toThrow(/already promoted/);
  });
});
