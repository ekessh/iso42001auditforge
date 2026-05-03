// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  buildWeightConfigChangedEvent,
  diffWeightConfig,
  WeightConfigChangedEventSchema,
} from '../src/index.js';
import { configWith, defaultConfig } from './fixtures.js';

describe('diffWeightConfig', () => {
  it('returns no diffs for identical configs', () => {
    expect(diffWeightConfig(defaultConfig(), defaultConfig())).toHaveLength(0);
  });

  it('captures scalar changes', () => {
    const before = defaultConfig();
    const after = configWith({ mandatoryWeight: 2.0 });
    const diffs = diffWeightConfig(before, after);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.field).toBe('mandatoryWeight');
    expect(diffs[0]!.before).toBe(1.5);
    expect(diffs[0]!.after).toBe(2.0);
  });

  it('captures per-clause additions and removals', () => {
    const before = configWith({ perClauseOverrides: { '4.1': 2 } });
    const after = configWith({ perClauseOverrides: { '6.1.2': 3 } });
    const diffs = diffWeightConfig(before, after);
    const fields = diffs.map((d) => d.field).sort();
    expect(fields).toContain('perClauseOverrides.4.1');
    expect(fields).toContain('perClauseOverrides.6.1.2');
  });

  it('captures per-family changes', () => {
    const before = configWith({
      perFamilyOverrides: { annex_a_6: 1.0 },
    });
    const after = configWith({
      perFamilyOverrides: { annex_a_6: 2.0 },
    });
    const diffs = diffWeightConfig(before, after);
    expect(diffs[0]!.field).toBe('perFamilyOverrides.annex_a_6');
    expect(diffs[0]!.after).toBe(2.0);
  });
});

describe('buildWeightConfigChangedEvent', () => {
  it('builds a valid event payload', () => {
    const before = defaultConfig();
    const after = configWith({ mandatoryWeight: 2 });
    const event = buildWeightConfigChangedEvent({
      engagementId: '11111111-1111-4111-8111-111111111111',
      changedBy: '22222222-2222-4222-8222-222222222222',
      changedAt: '2026-05-03T10:00:00.000Z',
      before,
      after,
    });
    const parsed = WeightConfigChangedEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
    expect(event.diffs.length).toBe(1);
    expect(event.type).toBe('weight_config_changed');
  });

  it('event payload round-trips through JSON', () => {
    const before = defaultConfig();
    const after = configWith({ mandatoryWeight: 2 });
    const event = buildWeightConfigChangedEvent({
      engagementId: '11111111-1111-4111-8111-111111111111',
      changedBy: '22222222-2222-4222-8222-222222222222',
      changedAt: '2026-05-03T10:00:00.000Z',
      before,
      after,
    });
    const back = JSON.parse(JSON.stringify(event));
    expect(WeightConfigChangedEventSchema.safeParse(back).success).toBe(true);
  });
});
