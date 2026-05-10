// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SampleUnit } from '../domain/unit.js';

/**
 * SamplingLedgerEvent — outbound port emitted by the override workflow and
 * draw helpers. The API adapter signs and persists into the audit ledger
 * (hash-chain + TSA).
 */
export type SamplingLedgerEvent =
  | {
      kind: 'sampling.drawn';
      planId: string;
      method: string;
      seed: string;
      populationSize: number;
      sampleSize: number;
      confidence: number;
      actorId: string;
      at: string;
    }
  | {
      kind: 'sampling.overridden';
      planId: string;
      removedUnitId: string;
      addedUnitId: string;
      rationale: string;
      actorId: string;
      at: string;
    };

export interface SamplingLedgerEmitter {
  emit(event: SamplingLedgerEvent): void;
}

export interface Clock {
  now(): string;
}

const SYSTEM_CLOCK: Clock = { now: () => new Date().toISOString() };

/**
 * SamplingOverrideWorkflow — auditor-driven swap of a drawn unit for cause.
 * Returns a new SampleUnit list (immutable swap) and emits a
 * `sampling.overridden` ledger event. Caller is responsible for
 * persistence and tenant scoping.
 */
export class SamplingOverrideWorkflow {
  constructor(
    private readonly ledger: SamplingLedgerEmitter,
    private readonly clock: Clock = SYSTEM_CLOCK,
  ) {}

  /**
   * Swap `removedUnitId` (currently in `currentUnits`) with `addedUnitId`
   * (must exist in `population.units` and not already be in the sample).
   * Audit-ledger event is emitted.
   */
  swap(args: {
    planId: string;
    population: SamplePopulation;
    currentUnits: readonly SampleUnit[];
    removedUnitId: string;
    addedUnitId: string;
    rationale: string;
    actorId: string;
  }): SampleUnit[] {
    if (args.rationale.trim().length === 0) {
      throw new ValidationError('Override requires non-empty rationale', {});
    }
    const idx = args.currentUnits.findIndex((u) => u.unitId === args.removedUnitId);
    if (idx === -1) {
      throw new ValidationError('Removed unit not in current sample', {
        removedUnitId: args.removedUnitId,
      });
    }
    if (args.currentUnits.some((u) => u.unitId === args.addedUnitId)) {
      throw new ValidationError('Added unit already in current sample', {
        addedUnitId: args.addedUnitId,
      });
    }
    const popUnit = args.population.units.find(
      (p: PopulationUnit) => p.id === args.addedUnitId,
    );
    if (!popUnit) {
      throw new ValidationError('Added unit not in population', {
        addedUnitId: args.addedUnitId,
      });
    }

    const removed = args.currentUnits[idx]!;
    const added: SampleUnit = {
      unitId: popUnit.id,
      planId: args.planId,
      selectionIndex: removed.selectionIndex,
      weight: removed.weight,
      ...(popUnit.stratum !== undefined ? { stratum: popUnit.stratum } : {}),
      rationale: args.rationale,
    };
    const next = [...args.currentUnits];
    next[idx] = added;

    const at = this.clock.now();
    this.ledger.emit({
      kind: 'sampling.overridden',
      planId: args.planId,
      removedUnitId: args.removedUnitId,
      addedUnitId: args.addedUnitId,
      rationale: args.rationale,
      actorId: args.actorId,
      at,
    });
    return next;
  }

  /** Convenience helper — emit `sampling.drawn` after a deterministic draw. */
  recordDraw(args: {
    planId: string;
    method: string;
    seed: string;
    populationSize: number;
    sampleSize: number;
    confidence: number;
    actorId: string;
  }): void {
    this.ledger.emit({
      kind: 'sampling.drawn',
      planId: args.planId,
      method: args.method,
      seed: args.seed,
      populationSize: args.populationSize,
      sampleSize: args.sampleSize,
      confidence: args.confidence,
      actorId: args.actorId,
      at: this.clock.now(),
    });
  }
}
