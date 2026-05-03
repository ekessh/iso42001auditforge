// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  CandidateFindingSchema,
  CandidateFindingTypeSchema,
  ConfidenceSchema,
  asClaimId,
  asClauseId,
  asControlId,
  asEpisodeId,
  asModelInvocationId,
} from '../src/index.js';

describe('Branded ID constructors', () => {
  it('rejects empty inputs', () => {
    expect(() => asClaimId('')).toThrow();
    expect(() => asClauseId('')).toThrow();
    expect(() => asControlId('')).toThrow();
    expect(() => asEpisodeId('')).toThrow();
    expect(() => asModelInvocationId('')).toThrow();
  });

  it('round-trips non-empty strings', () => {
    expect(asClaimId('c1')).toBe('c1');
    expect(asClauseId('6.1.2')).toBe('6.1.2');
  });
});

describe('CandidateFindingTypeSchema', () => {
  it('accepts the canonical four types', () => {
    for (const t of ['major_nc', 'minor_nc', 'ofi', 'observation']) {
      expect(CandidateFindingTypeSchema.safeParse(t).success).toBe(true);
    }
  });
  it('rejects unexpected values', () => {
    expect(CandidateFindingTypeSchema.safeParse('weird').success).toBe(false);
  });
});

describe('ConfidenceSchema', () => {
  it('accepts 0 and 1 inclusive', () => {
    expect(ConfidenceSchema.safeParse(0).success).toBe(true);
    expect(ConfidenceSchema.safeParse(0.5).success).toBe(true);
    expect(ConfidenceSchema.safeParse(1).success).toBe(true);
  });
  it('rejects out-of-range', () => {
    expect(ConfidenceSchema.safeParse(-0.1).success).toBe(false);
    expect(ConfidenceSchema.safeParse(1.1).success).toBe(false);
  });
});

describe('CandidateFindingSchema', () => {
  const valid = {
    id: '00000000-0000-4000-8000-000000000001',
    firmId: '00000000-0000-4000-8000-000000000aaa',
    engagementId: '00000000-0000-4000-8000-000000000bbb',
    type: 'minor_nc' as const,
    draftStatement: 'Auditee did not provide objective evidence.',
    linkedClauses: ['6.1.2'],
    linkedControls: [],
    sourceClaimIds: ['c1'],
    sourceEpisodeIds: ['ep1'],
    confidence: 0.7,
    suggestedRootCausePrompts: ['x'],
    proposedSeverityRationale: 'closed block',
    modelInvocationId: 'mi',
    status: 'pending' as const,
    createdAt: '2026-05-03T10:00:00.000Z',
    decidedBy: null,
    decidedAt: null,
    dismissalReason: null,
    detectorId: 'detector.evidence_absence.v1',
    promptTemplateVersion: 'nc_drafting.v1.0.0',
  };

  it('parses a known-good shape', () => {
    expect(CandidateFindingSchema.safeParse(valid).success).toBe(true);
  });

  it('requires at least one of sourceClaimIds or linkedClauses', () => {
    const empty = CandidateFindingSchema.safeParse({
      ...valid,
      sourceClaimIds: [],
      linkedClauses: [],
    });
    expect(empty.success).toBe(false);
  });

  it('accepts zero source claim IDs when linkedClauses is non-empty (evidence-absence path)', () => {
    const ok = CandidateFindingSchema.safeParse({
      ...valid,
      sourceClaimIds: [],
      linkedClauses: ['A.6.2.8'],
    });
    expect(ok.success).toBe(true);
  });

  it('coerces optional fields to defaults when omitted', () => {
    const minimal = { ...valid, linkedClauses: undefined };
    delete (minimal as Record<string, unknown>).linkedClauses;
    const out = CandidateFindingSchema.safeParse(minimal);
    expect(out.success).toBe(true);
  });
});
