// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MANDATORY_WEIGHT,
  DEFAULT_ANNEX_WEIGHT,
  calculateCoverageScore,
  defaultWeightFor,
  isMandatoryClause,
  type ClauseAssessment,
} from '../src/coverage-tracker/calculate.js';

describe('coverage calculate', () => {
  it('returns 0 overall when no clauses considered', () => {
    const r = calculateCoverageScore([]);
    expect(r.overall).toBe(0);
    expect(r.weightTotal).toBe(0);
  });

  it('mandatory clauses use 1.5 weight; Annex A uses 1.0', () => {
    expect(defaultWeightFor('5.1', true)).toBe(DEFAULT_MANDATORY_WEIGHT);
    expect(defaultWeightFor('A.4.2', true)).toBe(DEFAULT_ANNEX_WEIGHT);
  });

  it('out-of-scope clauses excluded from totals', () => {
    const r = calculateCoverageScore([
      { clauseId: '5.1', status: 'evidenced', inScope: false },
      { clauseId: '6.2', status: 'evidenced', inScope: true },
    ]);
    expect(r.considered).toBe(1);
    expect(r.excluded).toBe(1);
    expect(r.overall).toBe(1);
  });

  it('na clauses excluded from totals but counted in byStatus', () => {
    const r = calculateCoverageScore([
      { clauseId: 'A.5.10', status: 'na', inScope: true },
      { clauseId: '5.1', status: 'evidenced', inScope: true },
    ]);
    expect(r.considered).toBe(1);
    expect(r.excluded).toBe(1);
    expect(r.byStatus.na).toBe(1);
  });

  it('matches the CLAUDE.md formula on a fixture', () => {
    // 5.1 evidenced (mandatory, w=1.5, score=1.0) -> 1.5
    // 6.2 partial   (mandatory, w=1.5, score=0.5) -> 0.75
    // A.6.1.1 evidenced (annex, w=1.0, score=1.0) -> 1.0
    // A.7.5 contradicted (annex, w=1.0, score=0.0) -> 0.0
    // A.8.1 untouched (annex, w=1.0, score=0.0) -> 0.0
    // weightedSum = 3.25, weightTotal = 6.0, overall ~= 0.5417
    const fixture: ClauseAssessment[] = [
      { clauseId: '5.1', status: 'evidenced', inScope: true },
      { clauseId: '6.2', status: 'partial', inScope: true },
      { clauseId: 'A.6.1.1', status: 'evidenced', inScope: true },
      { clauseId: 'A.7.5', status: 'contradicted', inScope: true },
      { clauseId: 'A.8.1', status: 'untouched', inScope: true },
    ];
    const r = calculateCoverageScore(fixture);
    expect(r.weightedSum).toBeCloseTo(3.25, 6);
    expect(r.weightTotal).toBeCloseTo(6.0, 6);
    expect(r.overall).toBeCloseTo(3.25 / 6.0, 6);
  });

  it('explicit weight override wins', () => {
    const r = calculateCoverageScore([
      { clauseId: '5.1', status: 'evidenced', inScope: true, weight: 2.0 },
    ]);
    expect(r.weightTotal).toBe(2.0);
  });

  it('isMandatoryClause matches default ISO 42001 mandatory list', () => {
    expect(isMandatoryClause('4.1')).toBe(true);
    expect(isMandatoryClause('A.5.10')).toBe(false);
  });

  it('zero overall when only contradicted/untouched in-scope clauses', () => {
    const r = calculateCoverageScore([
      { clauseId: '5.1', status: 'contradicted', inScope: true },
      { clauseId: '6.2', status: 'untouched', inScope: true },
    ]);
    expect(r.overall).toBe(0);
    expect(r.considered).toBe(2);
  });
});
