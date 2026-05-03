// SPDX-License-Identifier: BUSL-1.1
/**
 * Weight-config audit events. v3 §15.14 mandates that any change to readiness
 * weights is logged in the audit ledger. This module captures the canonical
 * event shape and the diff helper. The actual ledger write goes through the
 * audit-ledger service; we emit a typed payload that ledger code can ingest.
 */
import { z } from 'zod';
import { IsoDateSchema, UuidSchema } from '@auditforge/shared';
import { WeightConfigSchema, type WeightConfig } from '../domain/types.js';

export const WeightConfigDiffSchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});
export type WeightConfigDiff = z.infer<typeof WeightConfigDiffSchema>;

export const WeightConfigChangedEventSchema = z.object({
  type: z.literal('weight_config_changed'),
  engagementId: UuidSchema,
  changedBy: UuidSchema,
  changedAt: IsoDateSchema,
  before: WeightConfigSchema,
  after: WeightConfigSchema,
  diffs: z.array(WeightConfigDiffSchema),
});
export type WeightConfigChangedEvent = z.infer<
  typeof WeightConfigChangedEventSchema
>;

/** Compute a flat diff between two weight configs. Order-stable, no recursion
 * past the per-clause / per-family sub-records (those are diffed key-by-key). */
export function diffWeightConfig(
  before: WeightConfig,
  after: WeightConfig,
): readonly WeightConfigDiff[] {
  const out: WeightConfigDiff[] = [];
  const scalarKeys: Array<keyof WeightConfig> = [
    'id',
    'version',
    'mandatoryWeight',
    'annexAWeight',
    'setBy',
    'setAt',
  ];
  for (const k of scalarKeys) {
    if (before[k] !== after[k]) {
      out.push({ field: String(k), before: before[k], after: after[k] });
    }
  }
  out.push(...diffRecord('perClauseOverrides', before.perClauseOverrides, after.perClauseOverrides));
  out.push(...diffRecord('perFamilyOverrides', before.perFamilyOverrides, after.perFamilyOverrides));
  return out;
}

function diffRecord(
  fieldRoot: string,
  before: Record<string, number> | undefined,
  after: Record<string, number> | undefined,
): WeightConfigDiff[] {
  const out: WeightConfigDiff[] = [];
  const beforeMap = before ?? {};
  const afterMap = after ?? {};
  const keys = new Set<string>([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
  for (const k of Array.from(keys).sort()) {
    const b = beforeMap[k];
    const a = afterMap[k];
    if (b !== a) {
      out.push({ field: `${fieldRoot}.${k}`, before: b, after: a });
    }
  }
  return out;
}

export function buildWeightConfigChangedEvent(args: {
  engagementId: string;
  changedBy: string;
  changedAt: string;
  before: WeightConfig;
  after: WeightConfig;
}): WeightConfigChangedEvent {
  return {
    type: 'weight_config_changed',
    engagementId: args.engagementId,
    changedBy: args.changedBy,
    changedAt: args.changedAt,
    before: args.before,
    after: args.after,
    diffs: [...diffWeightConfig(args.before, args.after)],
  };
}
