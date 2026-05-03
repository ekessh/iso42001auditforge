// SPDX-License-Identifier: BUSL-1.1
/**
 * ReadinessDashboard service per v3 §15.14.
 *
 * Pure data assembly — does not own UI rendering. Inputs come from upstream
 * services through `ReadinessDashboardDeps`; this layer composes them into the
 * payloads the Next.js workspace consumes.
 */
import type {
  ClauseFamily,
  ClauseState,
  OpenItem,
  ReadinessResult,
  SoaScope,
  TopBlocker,
  WeightConfig,
} from '../domain/types.js';
import { calcReadiness, resolveWeight, statusScore } from './calculator.js';

export interface ReadinessSnapshot {
  readonly at: string;
  readonly overall: number;
}

export interface AiSystemReadiness {
  readonly aiSystemId: string;
  readonly name: string;
  readonly readiness: number;
}

export interface ReadinessDashboardDeps {
  /** Provide the engagement's clause states. */
  getClauseStates(engagementId: string): Promise<readonly ClauseState[]>;
  /** Provide the engagement's SoA scope. */
  getSoa(engagementId: string): Promise<SoaScope>;
  /** Provide the engagement's effective weight config. */
  getWeightConfig(engagementId: string): Promise<WeightConfig>;
  /** Provide historical readiness snapshots (sorted ascending by at). */
  getReadinessHistory(
    engagementId: string,
    windowDays: number,
  ): Promise<readonly ReadinessSnapshot[]>;
  /** Provide open items for the panel. */
  getOpenItems(engagementId: string): Promise<readonly OpenItem[]>;
  /** Provide AI system inventory rows for the per-system breakdown. */
  getAiSystemReadiness(
    engagementId: string,
  ): Promise<readonly AiSystemReadiness[]>;
}

export interface HeroReadiness {
  readonly overall: number;
  readonly trend30d: number | null;
  readonly trend90d: number | null;
  readonly methodology: WeightConfig;
}

export interface FamilyGridCell {
  readonly family: ClauseFamily;
  readonly readiness: number;
  readonly evidenced: number;
  readonly partial: number;
  readonly contradicted: number;
  readonly untouched: number;
  readonly excluded: number;
}

export interface ClauseHeatmapTile {
  readonly clauseId: string;
  readonly status: ClauseState['status'];
  readonly weight: number;
  readonly score: number;
  readonly excluded: boolean;
}

export interface OpenItemsPanel {
  readonly improvementItems: readonly OpenItem[];
  readonly candidateFindings: readonly OpenItem[];
  readonly openNcs: readonly OpenItem[];
  readonly ofis: readonly OpenItem[];
}

export class ReadinessDashboard {
  constructor(private readonly deps: ReadinessDashboardDeps) {}

  private async snapshot(engagementId: string): Promise<ReadinessResult> {
    const [states, soa, cfg] = await Promise.all([
      this.deps.getClauseStates(engagementId),
      this.deps.getSoa(engagementId),
      this.deps.getWeightConfig(engagementId),
    ]);
    return calcReadiness(states, soa, cfg);
  }

  async heroReadiness(engagementId: string): Promise<HeroReadiness> {
    const result = await this.snapshot(engagementId);
    const [hist30, hist90] = await Promise.all([
      this.deps.getReadinessHistory(engagementId, 30),
      this.deps.getReadinessHistory(engagementId, 90),
    ]);
    return {
      overall: result.overall,
      trend30d: trendDelta(hist30, result.overall),
      trend90d: trendDelta(hist90, result.overall),
      methodology: result.methodology,
    };
  }

  async controlFamilyGrid(
    engagementId: string,
  ): Promise<readonly FamilyGridCell[]> {
    const [states, soa, cfg] = await Promise.all([
      this.deps.getClauseStates(engagementId),
      this.deps.getSoa(engagementId),
      this.deps.getWeightConfig(engagementId),
    ]);
    const result = calcReadiness(states, soa, cfg);
    const buckets = new Map<ClauseFamily, FamilyGridCell>();
    for (const c of result.perClause) {
      let cell = buckets.get(c.family);
      if (!cell) {
        cell = {
          family: c.family,
          readiness: result.perFamily[c.family] ?? 0,
          evidenced: 0,
          partial: 0,
          contradicted: 0,
          untouched: 0,
          excluded: 0,
        };
        buckets.set(c.family, cell);
      }
      const m = cell as { -readonly [K in keyof FamilyGridCell]: FamilyGridCell[K] };
      if (c.excluded) m.excluded += 1;
      else if (c.status === 'evidenced') m.evidenced += 1;
      else if (c.status === 'partial') m.partial += 1;
      else if (c.status === 'contradicted') m.contradicted += 1;
      else if (c.status === 'untouched') m.untouched += 1;
    }
    return Array.from(buckets.values());
  }

  async clauseHeatmap(
    engagementId: string,
    family: ClauseFamily,
  ): Promise<readonly ClauseHeatmapTile[]> {
    const result = await this.snapshot(engagementId);
    return result.perClause
      .filter((c) => c.family === family)
      .map((c) => ({
        clauseId: c.clauseId,
        status: c.status,
        weight: c.weight,
        score: c.score,
        excluded: c.excluded,
      }));
  }

  async openItemsPanel(engagementId: string): Promise<OpenItemsPanel> {
    const items = await this.deps.getOpenItems(engagementId);
    const out: OpenItemsPanel = {
      improvementItems: items.filter((i) => i.kind === 'improvement_item'),
      candidateFindings: items.filter((i) => i.kind === 'candidate_finding'),
      openNcs: items.filter((i) => i.kind === 'open_nc'),
      ofis: items.filter((i) => i.kind === 'ofi'),
    };
    return out;
  }

  async trendChart(
    engagementId: string,
    windowDays: number,
  ): Promise<readonly ReadinessSnapshot[]> {
    return this.deps.getReadinessHistory(engagementId, windowDays);
  }

  async topBlockers(
    engagementId: string,
    limit = 5,
  ): Promise<readonly TopBlocker[]> {
    const [states, soa, cfg] = await Promise.all([
      this.deps.getClauseStates(engagementId),
      this.deps.getSoa(engagementId),
      this.deps.getWeightConfig(engagementId),
    ]);
    const blockers: TopBlocker[] = [];
    for (const c of states) {
      const w = resolveWeight(c, soa, cfg);
      if (w == null) continue;
      const score = statusScore(c.status);
      if (score == null) continue;
      const gap = 1 - score;
      if (gap <= 0) continue;
      blockers.push({
        clauseId: c.clauseId,
        family: c.family,
        weightedImpact: w * gap,
        status: c.status,
        recommendedAction: recommendedAction(c.status, c.clauseId),
      });
    }
    blockers.sort((a, b) => b.weightedImpact - a.weightedImpact);
    return blockers.slice(0, Math.max(0, limit));
  }

  async aiSystemBreakdown(
    engagementId: string,
  ): Promise<readonly AiSystemReadiness[]> {
    return this.deps.getAiSystemReadiness(engagementId);
  }
}

function trendDelta(
  history: readonly ReadinessSnapshot[],
  current: number,
): number | null {
  if (history.length === 0) return null;
  const oldest = history[0]!;
  return current - oldest.overall;
}

function recommendedAction(
  status: ClauseState['status'],
  clauseId: string,
): string {
  switch (status) {
    case 'untouched':
      return `Start with the question library entry for ${clauseId}; gather first evidence.`;
    case 'partial':
      return `Close the gaps for ${clauseId}: identify missing evidence types and request samples.`;
    case 'contradicted':
      return `Resolve contradicting claims for ${clauseId} via a follow-up interview.`;
    case 'evidenced':
      return `No action required — clause is evidenced.`;
    case 'na':
      return `Confirm rationale for marking ${clauseId} N/A in the audit record.`;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
