// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  ReadinessDashboard,
  type AiSystemReadiness,
  type ClauseState,
  type OpenItem,
  type ReadinessDashboardDeps,
  type ReadinessSnapshot,
  type SoaScope,
  type WeightConfig,
} from '../src/index.js';
import { clause, defaultConfig, soa, ENGAGEMENT_ID } from './fixtures.js';

class StubDeps implements ReadinessDashboardDeps {
  states: ClauseState[] = [];
  soa: SoaScope = soa([]);
  cfg: WeightConfig = defaultConfig();
  history30: ReadinessSnapshot[] = [];
  history90: ReadinessSnapshot[] = [];
  openItems: OpenItem[] = [];
  aiSystems: AiSystemReadiness[] = [];

  async getClauseStates(): Promise<readonly ClauseState[]> {
    return this.states;
  }
  async getSoa(): Promise<SoaScope> {
    return this.soa;
  }
  async getWeightConfig(): Promise<WeightConfig> {
    return this.cfg;
  }
  async getReadinessHistory(
    _engagementId: string,
    windowDays: number,
  ): Promise<readonly ReadinessSnapshot[]> {
    return windowDays === 30 ? this.history30 : this.history90;
  }
  async getOpenItems(): Promise<readonly OpenItem[]> {
    return this.openItems;
  }
  async getAiSystemReadiness(): Promise<readonly AiSystemReadiness[]> {
    return this.aiSystems;
  }
}

describe('ReadinessDashboard.heroReadiness', () => {
  it('returns overall + 30/90d trends', async () => {
    const d = new StubDeps();
    d.states = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'partial'),
    ];
    d.soa = soa(['A.6.2.5']);
    d.history30 = [{ at: '2026-04-03T00:00:00.000Z', overall: 0.5 }];
    d.history90 = [{ at: '2026-02-03T00:00:00.000Z', overall: 0.3 }];
    const dash = new ReadinessDashboard(d);
    const hero = await dash.heroReadiness(ENGAGEMENT_ID);
    expect(hero.overall).toBeCloseTo(0.8, 6);
    expect(hero.trend30d).toBeCloseTo(0.3, 6);
    expect(hero.trend90d).toBeCloseTo(0.5, 6);
    expect(hero.methodology).toEqual(d.cfg);
  });

  it('returns null trend when no history is provided', async () => {
    const d = new StubDeps();
    d.states = [clause('4.1', 'main_body', 'evidenced')];
    const dash = new ReadinessDashboard(d);
    const hero = await dash.heroReadiness(ENGAGEMENT_ID);
    expect(hero.trend30d).toBeNull();
    expect(hero.trend90d).toBeNull();
  });
});

describe('ReadinessDashboard.controlFamilyGrid', () => {
  it('produces per-family cells with status counts', async () => {
    const d = new StubDeps();
    d.states = [
      clause('A.6.2.5', 'annex_a_6', 'evidenced'),
      clause('A.6.2.8', 'annex_a_6', 'partial'),
      clause('A.7.4', 'annex_a_7', 'untouched'),
    ];
    d.soa = soa(['A.6.2.5', 'A.6.2.8', 'A.7.4']);
    const dash = new ReadinessDashboard(d);
    const cells = await dash.controlFamilyGrid(ENGAGEMENT_ID);
    const a6 = cells.find((c) => c.family === 'annex_a_6')!;
    expect(a6.evidenced).toBe(1);
    expect(a6.partial).toBe(1);
    const a7 = cells.find((c) => c.family === 'annex_a_7')!;
    expect(a7.untouched).toBe(1);
  });
});

describe('ReadinessDashboard.clauseHeatmap', () => {
  it('returns tiles for the requested family only', async () => {
    const d = new StubDeps();
    d.states = [
      clause('A.6.2.5', 'annex_a_6', 'evidenced'),
      clause('A.7.4', 'annex_a_7', 'partial'),
    ];
    d.soa = soa(['A.6.2.5', 'A.7.4']);
    const dash = new ReadinessDashboard(d);
    const tiles = await dash.clauseHeatmap(ENGAGEMENT_ID, 'annex_a_6');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.clauseId).toBe('A.6.2.5');
  });
});

describe('ReadinessDashboard.openItemsPanel', () => {
  it('partitions items by kind', async () => {
    const d = new StubDeps();
    d.openItems = [
      {
        id: '1',
        kind: 'candidate_finding',
        clauseId: '4.1',
        severity: 'major',
        summary: 'x',
        createdAt: '2026-05-03T10:00:00.000Z',
      },
      {
        id: '2',
        kind: 'open_nc',
        clauseId: '4.1',
        severity: 'minor',
        summary: 'y',
        createdAt: '2026-05-03T10:00:00.000Z',
      },
      {
        id: '3',
        kind: 'ofi',
        clauseId: 'A.7.4',
        severity: 'ofi',
        summary: 'z',
        createdAt: '2026-05-03T10:00:00.000Z',
      },
      {
        id: '4',
        kind: 'improvement_item',
        clauseId: 'A.7.4',
        severity: null,
        summary: 'w',
        createdAt: '2026-05-03T10:00:00.000Z',
      },
    ];
    const dash = new ReadinessDashboard(d);
    const panel = await dash.openItemsPanel(ENGAGEMENT_ID);
    expect(panel.candidateFindings).toHaveLength(1);
    expect(panel.openNcs).toHaveLength(1);
    expect(panel.ofis).toHaveLength(1);
    expect(panel.improvementItems).toHaveLength(1);
  });
});

describe('ReadinessDashboard.topBlockers', () => {
  it('orders blockers by weighted impact, descending', async () => {
    const d = new StubDeps();
    d.states = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('6.1.2', 'main_body', 'untouched'), // weight 1.5, gap 1
      clause('A.6.2.5', 'annex_a_6', 'partial'), // weight 1.0, gap 0.5
      clause('A.6.2.8', 'annex_a_6', 'untouched'), // weight 1.0, gap 1
    ];
    d.soa = soa(['A.6.2.5', 'A.6.2.8']);
    const dash = new ReadinessDashboard(d);
    const blockers = await dash.topBlockers(ENGAGEMENT_ID, 5);
    // Expected ordering: 6.1.2 (1.5), A.6.2.8 (1.0), A.6.2.5 (0.5)
    expect(blockers.map((b) => b.clauseId)).toEqual([
      '6.1.2',
      'A.6.2.8',
      'A.6.2.5',
    ]);
  });

  it('respects limit', async () => {
    const d = new StubDeps();
    d.states = [
      clause('6.1.2', 'main_body', 'untouched'),
      clause('A.6.2.5', 'annex_a_6', 'untouched'),
    ];
    d.soa = soa(['A.6.2.5']);
    const dash = new ReadinessDashboard(d);
    const blockers = await dash.topBlockers(ENGAGEMENT_ID, 1);
    expect(blockers).toHaveLength(1);
  });

  it('skips evidenced and na clauses', async () => {
    const d = new StubDeps();
    d.states = [
      clause('4.1', 'main_body', 'evidenced'),
      clause('A.6.2.5', 'annex_a_6', 'na', { naRationale: 'no scope' }),
    ];
    d.soa = soa(['A.6.2.5']);
    const dash = new ReadinessDashboard(d);
    const blockers = await dash.topBlockers(ENGAGEMENT_ID, 5);
    expect(blockers).toHaveLength(0);
  });

  it('recommended action references the clause', async () => {
    const d = new StubDeps();
    d.states = [clause('6.1.2', 'main_body', 'untouched')];
    const dash = new ReadinessDashboard(d);
    const blockers = await dash.topBlockers(ENGAGEMENT_ID);
    expect(blockers[0]!.recommendedAction).toMatch(/6\.1\.2/);
  });
});

describe('ReadinessDashboard.trendChart', () => {
  it('forwards history from deps', async () => {
    const d = new StubDeps();
    d.history30 = [
      { at: '2026-05-01T00:00:00.000Z', overall: 0.4 },
      { at: '2026-05-02T00:00:00.000Z', overall: 0.5 },
    ];
    const dash = new ReadinessDashboard(d);
    const chart = await dash.trendChart(ENGAGEMENT_ID, 30);
    expect(chart).toHaveLength(2);
  });
});

describe('ReadinessDashboard.aiSystemBreakdown', () => {
  it('returns per-system readiness rows', async () => {
    const d = new StubDeps();
    d.aiSystems = [
      { aiSystemId: 'sys1', name: 'LLM A', readiness: 0.92 },
      { aiSystemId: 'sys2', name: 'Agent B', readiness: 0.41 },
    ];
    const dash = new ReadinessDashboard(d);
    const out = await dash.aiSystemBreakdown(ENGAGEMENT_ID);
    expect(out).toHaveLength(2);
    expect(out[0]!.name).toBe('LLM A');
  });
});
