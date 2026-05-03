// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SamplePlan } from '../domain/plan.js';
import type { SampleUnit } from '../domain/unit.js';

export interface JudgmentalPick {
  unitId: string;
  rationale: string;
}

/**
 * JudgmentalSamplingHelper — auditor-curated selection.
 *
 * Judgmental sampling is NOT random. It captures the auditor's expert
 * selection along with a written rationale for each unit, satisfying
 * ISO 17021 audit-trail requirements.
 *
 * Validation:
 *   - Every pick MUST exist in the population.
 *   - Every pick MUST carry a non-empty rationale.
 *   - No duplicates.
 *   - Selection size MUST equal `plan.size` (the calculator's output).
 */
export class JudgmentalSamplingHelper {
  curate(
    population: SamplePopulation,
    plan: Pick<SamplePlan, 'planId' | 'size'>,
    picks: ReadonlyArray<JudgmentalPick>,
  ): SampleUnit[] {
    if (picks.length !== plan.size)
      throw new Error(
        `JudgmentalSamplingHelper: expected ${plan.size} picks, got ${picks.length}`,
      );

    const byId = new Map<string, PopulationUnit>();
    for (const u of population.units) byId.set(u.id, u);

    const seen = new Set<string>();
    const out: SampleUnit[] = [];

    for (let i = 0; i < picks.length; i++) {
      const p = picks[i]!;
      if (!p.rationale || p.rationale.trim() === '')
        throw new Error(
          `JudgmentalSamplingHelper: rationale required for pick ${p.unitId}`,
        );
      if (seen.has(p.unitId))
        throw new Error(
          `JudgmentalSamplingHelper: duplicate pick ${p.unitId}`,
        );
      const u = byId.get(p.unitId);
      if (!u)
        throw new Error(
          `JudgmentalSamplingHelper: unitId ${p.unitId} not in population`,
        );
      seen.add(p.unitId);
      const unit: SampleUnit = {
        unitId: p.unitId,
        planId: plan.planId,
        selectionIndex: i,
        weight: 1,
        rationale: p.rationale,
      };
      if (u.stratum !== undefined) (unit as { stratum?: string }).stratum = u.stratum;
      out.push(unit);
    }
    return out;
  }
}
