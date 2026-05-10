// SPDX-License-Identifier: BUSL-1.1
import { StateMachineError } from '@auditforge/shared';
import type {
  AreaCoveredEvent,
  CoverageDelta,
  CoverageHistoryEntry,
  CoverageState,
  CoverageStatus,
} from '../types/domain.js';
import type { ClaimId, ClauseId, EngagementId, FirmId } from '../types/ids.js';

const VALID_TRANSITIONS: Readonly<Record<CoverageStatus, readonly CoverageStatus[]>> = {
  untouched: ['untouched', 'partial', 'evidenced', 'contradicted', 'na'],
  partial: ['partial', 'evidenced', 'contradicted', 'na'],
  evidenced: ['evidenced', 'contradicted', 'partial'],
  contradicted: ['contradicted', 'partial', 'evidenced'],
  na: ['na'],
};

export type AreaCoveredListener = (e: AreaCoveredEvent) => void;

export interface AreaDefinition {
  readonly engagementId: EngagementId;
  readonly areaId: string;
  readonly clauseIds: readonly ClauseId[];
}

export interface CoverageTrackerOptions {
  readonly areas?: readonly AreaDefinition[];
  readonly clock?: () => string;
}

export class CoverageTracker {
  private readonly states = new Map<string, CoverageState>();
  private readonly history: CoverageHistoryEntry[] = [];
  private readonly listeners: AreaCoveredListener[] = [];
  private readonly areas: AreaDefinition[];
  private readonly emittedAreaCovered = new Set<string>();
  private readonly clock: () => string;

  constructor(opts: CoverageTrackerOptions = {}) {
    this.areas = [...(opts.areas ?? [])];
    this.clock = opts.clock ?? (() => new Date().toISOString());
  }

  registerArea(def: AreaDefinition): void {
    this.areas.push(def);
  }

  onAreaCovered(listener: AreaCoveredListener): void {
    this.listeners.push(listener);
  }

  applyDelta(delta: CoverageDelta): CoverageState {
    const allowed = VALID_TRANSITIONS[delta.fromStatus];
    if (!allowed.includes(delta.toStatus)) {
      throw new StateMachineError(delta.fromStatus, delta.toStatus, {
        clauseId: delta.clauseId,
        engagementId: delta.engagementId,
      });
    }
    const key = stateKey(delta.engagementId, delta.clauseId);
    const prior = this.states.get(key);
    const fromStatus: CoverageStatus = prior?.status ?? 'untouched';
    if (prior && prior.status !== delta.fromStatus) {
      throw new StateMachineError(delta.fromStatus, delta.toStatus, {
        actualFrom: prior.status,
        clauseId: delta.clauseId,
      });
    }
    const lastClaimIds = prior?.lastClaimIds ?? [];
    const next: CoverageState = {
      firmId: prior?.firmId ?? (deriveFirmFromKey() as FirmId),
      engagementId: delta.engagementId,
      clauseId: delta.clauseId,
      status: delta.toStatus,
      confidence: clamp01(
        (prior?.confidence ?? 0) + delta.confidenceDelta,
      ),
      lastUpdate: delta.at,
      lastClaimIds: delta.claimId
        ? dedupeAppend(lastClaimIds, delta.claimId)
        : lastClaimIds,
    };
    this.states.set(key, next);
    this.history.push({
      engagementId: delta.engagementId,
      clauseId: delta.clauseId,
      fromStatus,
      toStatus: delta.toStatus,
      at: delta.at,
      reason: delta.reason,
      claimId: delta.claimId,
    });
    this.checkAreas(delta.engagementId);
    return next;
  }

  getState(
    engagementId: EngagementId,
    clauseIds: readonly ClauseId[],
  ): ReadonlyMap<ClauseId, CoverageState> {
    const map = new Map<ClauseId, CoverageState>();
    for (const c of clauseIds) {
      const s = this.states.get(stateKey(engagementId, c));
      if (s) map.set(c, s);
    }
    return map;
  }

  /**
   * Returns the coverage map keyed by clauseId-as-string for engine consumption.
   */
  asCoverageMap(engagementId: EngagementId): ReadonlyMap<string, CoverageState> {
    const map = new Map<string, CoverageState>();
    for (const [_k, v] of this.states.entries()) {
      if (v.engagementId === engagementId) map.set(v.clauseId as unknown as string, v);
    }
    return map;
  }

  getHistory(
    engagementId: EngagementId,
    clauseId?: ClauseId,
  ): readonly CoverageHistoryEntry[] {
    return this.history.filter(
      (h) =>
        h.engagementId === engagementId &&
        (clauseId === undefined || h.clauseId === clauseId),
    );
  }

  /**
   * Recompute clears in-memory state for a given engagement and replays the
   * history. Useful for crash recovery and test-fixture validation.
   */
  recompute(engagementId: EngagementId): void {
    const replay = this.history.filter((h) => h.engagementId === engagementId);
    // wipe state for engagement
    for (const k of [...this.states.keys()]) {
      const v = this.states.get(k);
      if (v && v.engagementId === engagementId) this.states.delete(k);
    }
    this.emittedAreaCovered.clear();
    for (const h of replay) {
      const key = stateKey(h.engagementId, h.clauseId);
      const prior = this.states.get(key);
      const next: CoverageState = {
        firmId: prior?.firmId ?? (deriveFirmFromKey() as FirmId),
        engagementId: h.engagementId,
        clauseId: h.clauseId,
        status: h.toStatus,
        confidence: prior?.confidence ?? 0,
        lastUpdate: h.at,
        lastClaimIds: h.claimId
          ? dedupeAppend(prior?.lastClaimIds ?? [], h.claimId)
          : prior?.lastClaimIds ?? [],
      };
      this.states.set(key, next);
    }
    this.checkAreas(engagementId);
  }

  private checkAreas(engagementId: EngagementId): void {
    for (const area of this.areas) {
      if (area.engagementId !== engagementId) continue;
      const key = `${engagementId}::${area.areaId}`;
      if (this.emittedAreaCovered.has(key)) continue;
      const allCovered = area.clauseIds.every((c) => {
        const s = this.states.get(stateKey(engagementId, c));
        return s !== undefined && (s.status === 'evidenced' || s.status === 'na');
      });
      if (allCovered && area.clauseIds.length > 0) {
        this.emittedAreaCovered.add(key);
        const event: AreaCoveredEvent = {
          engagementId,
          areaId: area.areaId,
          clauseIds: area.clauseIds,
          at: this.clock(),
        };
        for (const l of this.listeners) l(event);
      }
    }
  }
}

function stateKey(engagementId: EngagementId, clauseId: ClauseId): string {
  return `${engagementId as unknown as string}::${clauseId as unknown as string}`;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function dedupeAppend(arr: readonly ClaimId[], v: ClaimId): readonly ClaimId[] {
  if (arr.includes(v)) return arr;
  return [...arr, v];
}

function deriveFirmFromKey(): string {
  return '00000000-0000-4000-8000-000000000000';
}
