// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema, UuidSchema } from '@auditforge/shared';

export const SampleUnitSchema = z.object({
  unitId: NonEmptyStringSchema,
  /** Backref to the plan this unit belongs to. */
  planId: UuidSchema,
  /** 0-based index in the selection order (deterministic for seeded methods). */
  selectionIndex: z.number().int().nonnegative(),
  stratum: NonEmptyStringSchema.optional(),
  /** Effective selection weight (1.0 for uniform random; risk-based varies). */
  weight: z.number().nonnegative().default(1),
  /** Required for `judgmental` method: capture WHY this unit was hand-picked. */
  rationale: z.string().optional(),
});
export type SampleUnit = z.infer<typeof SampleUnitSchema>;
