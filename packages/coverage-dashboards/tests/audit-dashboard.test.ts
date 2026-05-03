// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  AuditDashboard,
  type AuditDashboardDeps,
  type CandidateFindingsCount,
  type ClauseState,
  type ManDayPlan,
  type PromotedFindingsCount,
  type SamplingPlan,
  type SoaScope,
  type WeightConfig,
} from '../src/index.js';
import { clause, defaultConfig, soa, ENGAGEMENT_ID } from './fixtures.js';

class StubDeps implements AuditDashboardDeps {
  states: ClauseState[] = [];
  soaScope: SoaScope = soa([]);
  cfg: WeightConfig = defaultConfig();
  manDays: ManDayPlan = { plannedTotal: 5, consumed: 2 };
  samples: SamplingPlan = { plannedSamples: 10, executedSamples: 7 };
  candidates: CandidateFindingsCount = {
    major: 1,
    minor: 2,
    ofi: 3,
    observation: 0,
  };
  promoted: PromotedFindingsCount = {
    majorNc: 1,
    minorNc: 1,
    ofi: 0,
    conformity: 0,
  };

  async getClauseStates(): Promise<readonly ClauseState[]> {
    return this.states;
  }
  async getSoa(): Promise<SoaScope> {
    return this.soaScope;
  }
  async getWeightConfig(): Promise<WeightConfig> {
    return this.cfg;
  }
  async getManDayPlan(): Promise<ManDayPlan> {
    return this.manDays;
  }
  async getSamplingPlan(): Promise<SamplingPlan> {
    return this.samples;
  }
  async getCandidateFindingsCount(): Promise<CandidateFindingsCount> {
    return this.candidates;
  }
  async getPromotedFindingsCount(): Promise<PromotedFindingsCount> {
    return this.promoted;
  }
}

describe('AuditDashboard.coveragePerArea', () => {
  it('groups by family and returns evidenced ratio', async () => {
    const d = new StubDeps();
    d.states = [
      clause('A.6.2.5', 'annex_a_6', 'evidenced'),
      clause('A.6.2.8', 'annex_a_6', 'untouched'),
      clause('A.7.4', 'annex_a_7', 'evidenced'),
    ];
    d.soaScope = soa(['A.6.2.5', 'A.6.2.8', 'A.7.4']);
    const dash = new AuditDashboard(d);
    const out = await dash.coveragePerArea(ENGAGEMENT_ID);
    const a6 = out.find((x) => x.family === 'annex_a_6')!;
    expect(a6.coveragePct).toBeCloseTo(0.5, 6);
    expect(a6.inScopeCount).toBe(2);
    const a7 = out.find((x) => x.family === 'annex_a_7')!;
    expect(a7.coveragePct).toBe(1);
  });

  it('excludes out-of-scope clauses', async () => {
    const d = new StubDeps();
    d.states = [
      clause('A.6.2.5', 'annex_a_6', 'evidenced'),
      clause('A.10.4', 'annex_a_10', 'untouched', {
        mandatory: false,
        inScope: false,
      }),
    ];
    d.soaScope = soa(['A.6.2.5']);
    const dash = new AuditDashboard(d);
    const out = await dash.coveragePerArea(ENGAGEMENT_ID);
    expect(out.find((x) => x.family === 'annex_a_10')).toBeUndefined();
  });
});

describe('AuditDashboard.manDayBurndown', () => {
  it('returns planned/consumed/remaining/ratio', async () => {
    const d = new StubDeps();
    d.manDays = { plannedTotal: 8, consumed: 6 };
    const dash = new AuditDashboard(d);
    const out = await dash.manDayBurndown(ENGAGEMENT_ID);
    expect(out.planned).toBe(8);
    expect(out.consumed).toBe(6);
    expect(out.remaining).toBe(2);
    expect(out.ratio).toBeCloseTo(0.75, 6);
  });

  it('handles zero planned', async () => {
    const d = new StubDeps();
    d.manDays = { plannedTotal: 0, consumed: 0 };
    const dash = new AuditDashboard(d);
    const out = await dash.manDayBurndown(ENGAGEMENT_ID);
    expect(out.ratio).toBe(0);
    expect(out.remaining).toBe(0);
  });
});

describe('AuditDashboard counts pass-through', () => {
  it('returns candidate findings count', async () => {
    const d = new StubDeps();
    const dash = new AuditDashboard(d);
    const out = await dash.openCandidateFindingsCount(ENGAGEMENT_ID);
    expect(out.major).toBe(1);
    expect(out.minor).toBe(2);
    expect(out.ofi).toBe(3);
  });

  it('returns promoted findings count', async () => {
    const d = new StubDeps();
    const dash = new AuditDashboard(d);
    const out = await dash.promotedFindingsCount(ENGAGEMENT_ID);
    expect(out.majorNc).toBe(1);
    expect(out.minorNc).toBe(1);
  });
});

describe('AuditDashboard.samplingCompleteness', () => {
  it('returns planned/executed/ratio', async () => {
    const d = new StubDeps();
    d.samples = { plannedSamples: 20, executedSamples: 15 };
    const dash = new AuditDashboard(d);
    const out = await dash.samplingCompleteness(ENGAGEMENT_ID);
    expect(out.ratio).toBeCloseTo(0.75, 6);
  });
});

describe('AuditDashboard.riskIndicator', () => {
  it('returns on_track when readiness>=0.7 and time ratio<=1', async () => {
    const d = new StubDeps();
    d.states = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'evidenced'),
    ];
    d.soaScope = soa(['A.6.2.5']);
    d.manDays = { plannedTotal: 10, consumed: 5 };
    const dash = new AuditDashboard(d);
    expect(await dash.riskIndicator(ENGAGEMENT_ID)).toBe('on_track');
  });

  it('returns coverage_gap when readiness<0.7', async () => {
    const d = new StubDeps();
    d.states = [
      clause('4.1', 'main_body', 'untouched'),
      clause('A.6.2.5', 'annex_a_6', 'untouched'),
    ];
    d.soaScope = soa(['A.6.2.5']);
    d.manDays = { plannedTotal: 10, consumed: 5 };
    const dash = new AuditDashboard(d);
    expect(await dash.riskIndicator(ENGAGEMENT_ID)).toBe('coverage_gap');
  });

  it('returns time_overrun when consumed > planned', async () => {
    const d = new StubDeps();
    d.states = [clause('4.1', 'main_body', 'evidenced')];
    d.manDays = { plannedTotal: 5, consumed: 8 };
    const dash = new AuditDashboard(d);
    expect(await dash.riskIndicator(ENGAGEMENT_ID)).toBe('time_overrun');
  });

  it('time_overrun takes precedence over coverage_gap', async () => {
    const d = new StubDeps();
    d.states = [clause('4.1', 'main_body', 'untouched')];
    d.manDays = { plannedTotal: 5, consumed: 8 };
    const dash = new AuditDashboard(d);
    expect(await dash.riskIndicator(ENGAGEMENT_ID)).toBe('time_overrun');
  });
});
