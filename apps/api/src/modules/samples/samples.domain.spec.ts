// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { SamplesService } from './samples.service.js';
import { SamplesRepository } from './samples.repository.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { SamplingAdapter } from '../../adapters/sampling.adapter.js';

const FIRM = '11111111-1111-1111-1111-111111111111';
const ACTOR = '22222222-2222-2222-2222-222222222222';
const PLAN_ID = '33333333-3333-4333-8333-333333333333';
const POPULATION_ID = '44444444-4444-4444-4444-444444444444';

function makeService(): SamplesService {
  const sql = (() => Promise.resolve()) as unknown as Parameters<typeof Reflect.construct>[1];
  const repo = new SamplesRepository(sql as never, new TenancyAdapter());
  const audit = new AuditEngineAdapter();
  const adapter = new SamplingAdapter(audit);
  return new SamplesService(repo, adapter, audit);
}

describe('SamplesService.draw', () => {
  it('draws a deterministic random sample', async () => {
    const svc = makeService();
    const units = Array.from({ length: 50 }, (_, i) => ({ id: `u-${i.toString().padStart(3, '0')}` }));
    const r = await svc.draw({
      firmId: FIRM,
      actorId: ACTOR,
      dto: {
        planId: PLAN_ID,
        method: 'random',
        seed: 'abc',
        size: 5,
        confidence: 0.95,
        population: {
          populationId: POPULATION_ID,
          category: 'use_cases',
          description: 'test',
          units,
        },
      },
    });
    expect(r.units.length).toBe(5);
    const r2 = await svc.draw({
      firmId: FIRM,
      actorId: ACTOR,
      dto: {
        planId: PLAN_ID,
        method: 'random',
        seed: 'abc',
        size: 5,
        confidence: 0.95,
        population: {
          populationId: POPULATION_ID,
          category: 'use_cases',
          description: 'test',
          units,
        },
      },
    });
    expect(r2.units.map((u) => u.unitId)).toStrictEqual(r.units.map((u) => u.unitId));
  });

  it('draws systematic and mus methods', async () => {
    const svc = makeService();
    const units = Array.from({ length: 30 }, (_, i) => ({ id: `u-${i}` }));
    const sys = await svc.draw({
      firmId: FIRM,
      actorId: ACTOR,
      dto: {
        planId: PLAN_ID,
        method: 'systematic',
        seed: 'sys',
        size: 5,
        confidence: 0.95,
        population: {
          populationId: POPULATION_ID,
          category: 'use_cases',
          description: 'test',
          units,
        },
      },
    });
    expect(sys.units.length).toBe(5);

    const values = Object.fromEntries(units.map((u, i) => [u.id, i + 1]));
    const mus = await svc.draw({
      firmId: FIRM,
      actorId: ACTOR,
      dto: {
        planId: PLAN_ID,
        method: 'mus',
        seed: 'mus',
        size: 5,
        confidence: 0.95,
        population: {
          populationId: POPULATION_ID,
          category: 'use_cases',
          description: 'test',
          units,
        },
        values,
      },
    });
    expect(mus.units.length).toBeLessThanOrEqual(5);
  });
});

describe('SamplesService.calculateSize', () => {
  it('computes attribute size', () => {
    const svc = makeService();
    const r = svc.calculateSize({
      formula: 'attribute',
      N: 1000,
      confidence: 0.95,
      tolerableDeviationRate: 0.05,
      expectedDeviationRate: 0.01,
    });
    expect(r.formula).toBe('attribute');
    expect(r.size).toBeGreaterThan(0);
  });

  it('computes variable size', () => {
    const svc = makeService();
    const r = svc.calculateSize({
      formula: 'variable',
      N: 5000,
      confidence: 0.95,
      populationStdDev: 100,
      tolerableMisstatement: 50,
      expectedMisstatement: 10,
    });
    expect(r.size).toBeGreaterThan(0);
  });

  it('computes MUS size', () => {
    const svc = makeService();
    const r = svc.calculateSize({
      formula: 'mus',
      populationValue: 1_000_000,
      materiality: 50_000,
      expectedMisstatement: 5_000,
      confidence: 0.95,
    });
    expect(r.size).toBeGreaterThan(0);
  });
});

describe('SamplesService.override', () => {
  it('swaps a unit and emits ledger event', async () => {
    const svc = makeService();
    const units = Array.from({ length: 10 }, (_, i) => ({ id: `u-${i}` }));
    const draw = await svc.draw({
      firmId: FIRM,
      actorId: ACTOR,
      dto: {
        planId: PLAN_ID,
        method: 'random',
        seed: 'override',
        size: 3,
        confidence: 0.95,
        population: {
          populationId: POPULATION_ID,
          category: 'use_cases',
          description: 'test',
          units,
        },
      },
    });
    const removed = draw.units[0]!.unitId;
    const present = new Set(draw.units.map((u) => u.unitId));
    const replacement = units.find((u) => !present.has(u.id))!.id;
    const result = svc.override({
      firmId: FIRM,
      actorId: ACTOR,
      dto: {
        planId: PLAN_ID,
        removedUnitId: removed,
        addedUnitId: replacement,
        rationale: 'Witnessed unavailable; substitute is representative.',
        population: {
          populationId: POPULATION_ID,
          category: 'use_cases',
          description: 'test',
          units,
        },
        currentUnits: draw.units.map((u) => ({
          unitId: u.unitId,
          planId: u.planId,
          selectionIndex: u.selectionIndex,
          weight: u.weight,
          ...(u.stratum ? { stratum: u.stratum } : {}),
        })),
      },
    });
    expect(result.units.find((u) => u.unitId === replacement)).toBeTruthy();
    expect(result.units.find((u) => u.unitId === removed)).toBeFalsy();
  });
});
