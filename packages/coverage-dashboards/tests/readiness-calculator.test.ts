// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  calcReadiness,
  resolveWeight,
  statusScore,
  type ClauseState,
} from '../src/index.js';
import { clause, configWith, defaultConfig, soa } from './fixtures.js';

describe('statusScore', () => {
  it('maps statuses to canonical scores', () => {
    expect(statusScore('evidenced')).toBe(1.0);
    expect(statusScore('partial')).toBe(0.5);
    expect(statusScore('contradicted')).toBe(0);
    expect(statusScore('untouched')).toBe(0);
    expect(statusScore('na')).toBeNull();
  });
});

describe('resolveWeight', () => {
  const cfg = defaultConfig();

  it('returns mandatory weight for main-body clauses', () => {
    const c = clause('4.1', 'main_body', 'evidenced', { mandatory: true });
    expect(resolveWeight(c, soa([]), cfg)).toBe(1.5);
  });

  it('returns annexA weight for in-scope Annex A clauses', () => {
    const c = clause('A.6.2.5', 'annex_a_6', 'evidenced', { mandatory: false });
    expect(resolveWeight(c, soa(['A.6.2.5']), cfg)).toBe(1.0);
  });

  it('excludes (returns null) for out-of-scope Annex A clauses', () => {
    const c = clause('A.7.4', 'annex_a_7', 'evidenced', {
      mandatory: false,
      inScope: false,
    });
    expect(resolveWeight(c, soa([]), cfg)).toBeNull();
  });

  it('excludes (returns null) when status is na', () => {
    const c = clause('A.7.4', 'annex_a_7', 'na', {
      mandatory: false,
      naRationale: 'Not applicable.',
    });
    expect(resolveWeight(c, soa(['A.7.4']), cfg)).toBeNull();
  });

  it('honours per-clause overrides', () => {
    const c = clause('4.1', 'main_body', 'evidenced', { mandatory: true });
    const override = configWith({ perClauseOverrides: { '4.1': 3 } });
    expect(resolveWeight(c, soa([]), override)).toBe(3);
  });

  it('honours per-family overrides when no per-clause override exists', () => {
    const c = clause('A.10.4', 'annex_a_10', 'evidenced', { mandatory: false });
    const override = configWith({
      perFamilyOverrides: { annex_a_10: 2 },
    });
    expect(resolveWeight(c, soa(['A.10.4']), override)).toBe(2);
  });
});

describe('calcReadiness — golden cases', () => {
  it('all evidenced → overall 1.0', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'evidenced'),
    ];
    const res = calcReadiness(states, soa(['A.6.2.5']), defaultConfig());
    expect(res.overall).toBe(1);
    expect(res.perFamily.main_body).toBe(1);
    expect(res.perFamily.annex_a_6).toBe(1);
  });

  it('all untouched → overall 0', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'untouched'),
      clause('A.6.2.5', 'annex_a_6', 'untouched'),
    ];
    const res = calcReadiness(states, soa(['A.6.2.5']), defaultConfig());
    expect(res.overall).toBe(0);
  });

  it('mix of evidenced + partial weighted correctly', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'), // weight 1.5, score 1.0
      clause('A.6.2.5', 'annex_a_6', 'partial'), // weight 1.0, score 0.5
    ];
    const res = calcReadiness(states, soa(['A.6.2.5']), defaultConfig());
    // (1.5*1 + 1.0*0.5) / (1.5 + 1.0) = 2.0 / 2.5 = 0.8
    expect(res.overall).toBeCloseTo(0.8, 6);
  });

  it('contradicted contributes 0 to numerator but is still weighted', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'contradicted'),
    ];
    const res = calcReadiness(states, soa(['A.6.2.5']), defaultConfig());
    // (1.5*1 + 1.0*0) / 2.5 = 0.6
    expect(res.overall).toBeCloseTo(0.6, 6);
  });

  it('N/A clauses are excluded from numerator AND denominator', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'na', { naRationale: 'no scope' }),
    ];
    const res = calcReadiness(states, soa(['A.6.2.5']), defaultConfig());
    expect(res.overall).toBe(1);
  });

  it('out-of-scope Annex A is excluded entirely', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.10.4', 'annex_a_10', 'untouched', {
        mandatory: false,
        inScope: false,
      }),
    ];
    const res = calcReadiness(states, soa([]), defaultConfig());
    expect(res.overall).toBe(1);
    const a10 = res.perClause.find((c) => c.clauseId === 'A.10.4');
    expect(a10?.excluded).toBe(true);
  });

  it('per-clause overrides change the weighted result', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'untouched'),
    ];
    const cfg = configWith({ perClauseOverrides: { 'A.6.2.5': 5 } });
    const res = calcReadiness(states, soa(['A.6.2.5']), cfg);
    // (1.5*1 + 5*0) / (1.5 + 5) = 1.5 / 6.5 ≈ 0.2308
    expect(res.overall).toBeCloseTo(1.5 / 6.5, 6);
  });

  it('produces empty perFamily when nothing in scope', () => {
    const states: ClauseState[] = [
      clause('A.10.4', 'annex_a_10', 'evidenced', {
        mandatory: false,
        inScope: false,
      }),
    ];
    const res = calcReadiness(states, soa([]), defaultConfig());
    expect(res.overall).toBe(0);
    expect(Object.keys(res.perFamily)).toEqual([]);
  });

  it('perClause output preserves insertion order', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'partial'),
      clause('A.7.4', 'annex_a_7', 'untouched'),
    ];
    const res = calcReadiness(states, soa(['A.6.2.5', 'A.7.4']), defaultConfig());
    expect(res.perClause.map((c) => c.clauseId)).toEqual([
      '4.1',
      'A.6.2.5',
      'A.7.4',
    ]);
  });
});

describe('Methodology JSON round-trip', () => {
  it('round-trips the weight config via JSON', () => {
    const cfg = configWith({
      perClauseOverrides: { '4.1': 2.5 },
      perFamilyOverrides: { annex_a_6: 1.25 },
    });
    const json = JSON.stringify(cfg);
    const back = JSON.parse(json);
    expect(back).toEqual(cfg);
  });

  it('round-trips the readiness result via JSON', () => {
    const states: ClauseState[] = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'partial'),
    ];
    const res = calcReadiness(states, soa(['A.6.2.5']), defaultConfig());
    const json = JSON.stringify(res);
    const back = JSON.parse(json);
    expect(back.overall).toBeCloseTo(res.overall, 12);
    expect(back.methodology).toEqual(res.methodology);
    expect(back.perClause).toEqual(res.perClause);
  });
});
