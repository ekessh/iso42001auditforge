// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';
import { SamplingMethodSchema } from './method.js';
import { SamplePopulationCategorySchema } from './population.js';

export const SamplePlanSchema = z.object({
  planId: UuidSchema,
  populationId: UuidSchema,
  populationCategory: SamplePopulationCategorySchema,
  populationSize: z.number().int().nonnegative(),
  method: SamplingMethodSchema,
  size: z.number().int().nonnegative(),
  /** Auditor narrative explaining method/size choice. */
  rationale: NonEmptyStringSchema,
  /** Deterministic seed; required for reproducibility on probabilistic methods. */
  seed: NonEmptyStringSchema,
  /** Scheme rule id used by the size calculator (e.g. `default-sqrt`). */
  schemeRuleId: NonEmptyStringSchema,
  /** Audit-trail timestamps. */
  createdAt: IsoDateSchema,
  /** Optional minimum/maximum size bounds applied. */
  bounds: z
    .object({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
    })
    .optional(),
});
export type SamplePlan = z.infer<typeof SamplePlanSchema>;
