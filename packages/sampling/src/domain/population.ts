// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema, UuidSchema } from '@auditforge/shared';

/**
 * SamplePopulation — the universe from which audit samples are drawn.
 *
 * Categories follow Section 3.10 of `auditforge.md`. Each unit MUST carry a
 * stable `id` (typically a UUID minted by the auditee system or our ingestion
 * layer) so that re-running the same plan with the same seed yields the same
 * selection.
 */
export const SamplePopulationCategorySchema = z.enum([
  'use_cases',
  'models',
  'agents',
  'datasets',
  'incidents',
  'transactions',
]);
export type SamplePopulationCategory = z.infer<
  typeof SamplePopulationCategorySchema
>;

export const PopulationUnitSchema = z.object({
  id: NonEmptyStringSchema,
  /** Optional stratum label for stratified sampling (e.g. severity, env). */
  stratum: NonEmptyStringSchema.optional(),
  /** Optional risk score in [0, 100] for risk-based sampling. */
  riskScore: z.number().min(0).max(100).optional(),
  /** Free-form metadata for auditor display. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PopulationUnit = z.infer<typeof PopulationUnitSchema>;

export const SamplePopulationSchema = z.object({
  populationId: UuidSchema,
  category: SamplePopulationCategorySchema,
  /** Description of the universe (e.g. "Q3 2025 production AI use-cases"). */
  description: NonEmptyStringSchema,
  units: z.array(PopulationUnitSchema),
  /** Declared distribution per stratum, sums to ~1.0. */
  declaredStrataDistribution: z.record(z.string(), z.number().min(0).max(1)).optional(),
});
export type SamplePopulation = z.infer<typeof SamplePopulationSchema>;

/**
 * Compute the empirical stratum distribution from a population. Returns an
 * empty object when `strata` are not declared on units.
 */
export function empiricalStrataDistribution(
  population: SamplePopulation,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const u of population.units) {
    if (u.stratum) counts[u.stratum] = (counts[u.stratum] ?? 0) + 1;
  }
  const total = population.units.length;
  if (total === 0) return {};
  const dist: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) dist[k] = v / total;
  return dist;
}
