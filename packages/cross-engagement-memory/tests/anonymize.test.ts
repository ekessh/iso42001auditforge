// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { checkDimensions, checkObservation, checkPattern } from '../src/anonymize.js';
import type { CrossEngagementPattern } from '../src/domain.js';

describe('cross-engagement-memory anonymize', () => {
  it('rejects denied dimension keys', () => {
    expect(checkDimensions({ auditeeName: 'Acme Inc' }).ok).toBe(false);
    expect(checkDimensions({ engagement_id: 'eng-1' }).ok).toBe(false);
    expect(checkDimensions({ system_name: 'recommender' }).ok).toBe(false);
  });

  it('rejects bad dimension key shapes', () => {
    expect(checkDimensions({ 'Bad Key': 'v' }).ok).toBe(false);
    expect(checkDimensions({ AAAaaaaa: 'v' }).ok).toBe(false);
  });

  it('accepts canonical scope dimensions', () => {
    expect(
      checkDimensions({ industry: 'healthcare', model_kind: 'recommender', clause_id: 'A.7.4' })
        .ok,
    ).toBe(true);
  });

  it('rejects dimension values that look like personal names', () => {
    expect(checkDimensions({ industry: 'Jane Doe' }).ok).toBe(false);
    expect(checkDimensions({ industry: 'John Smith Jr' }).ok).toBe(false);
  });

  it('rejects long dimension values', () => {
    expect(checkDimensions({ industry: 'a'.repeat(65) }).ok).toBe(false);
  });

  it('rejects observation containing a forbidden phrase', () => {
    expect(checkObservation('Finding 12 references improper data quality').ok).toBe(false);
    expect(checkObservation('finding describes a gap').ok).toBe(false);
  });

  it('rejects observation containing capitalised name pattern', () => {
    expect(
      checkObservation('Across engagements Jane Doe disclosed missing controls').ok,
    ).toBe(false);
  });

  it('rejects observation with email address', () => {
    expect(
      checkObservation('control owner email auditor@example.com seen across runs').ok,
    ).toBe(false);
  });

  it('accepts a clean observation', () => {
    expect(
      checkObservation('clause A.7.4 fails evidence requirements at 23% across 17 observations')
        .ok,
    ).toBe(true);
  });

  it('checkPattern rejects when dimensions or observation fail', () => {
    const bad: CrossEngagementPattern = {
      id: 'pat_1',
      firmId: 'firm-1',
      patternKind: 'clause_evidence_failure_rate',
      dimensions: { auditeeName: 'Acme' },
      sampleSize: 5,
      observation: 'clause A.7.4 fails 20%',
      confidence: 0.8,
      lastUpdated: '2026-04-01T00:00:00Z',
    };
    expect(checkPattern(bad).ok).toBe(false);
  });

  it('checkPattern accepts a clean row', () => {
    const good: CrossEngagementPattern = {
      id: 'pat_2',
      firmId: 'firm-1',
      patternKind: 'clause_evidence_failure_rate',
      dimensions: { industry: 'healthcare', clause_id: 'A.7.4' },
      sampleSize: 5,
      observation: 'clause A.7.4 fails evidence requirements at 20% across 5 observations',
      confidence: 0.5,
      lastUpdated: '2026-04-01T00:00:00Z',
    };
    expect(checkPattern(good).ok).toBe(true);
  });
});
