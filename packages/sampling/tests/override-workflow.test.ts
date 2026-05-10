// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { RandomSampler } from '../src/services/random-sampler.js';
import {
  SamplingOverrideWorkflow,
  type SamplingLedgerEvent,
} from '../src/services/override-workflow.js';
import { makePopulation } from './helpers.js';

const PLAN = { planId: '00000000-0000-4000-8000-000000000333', size: 5, seed: 'override' };

function makeLedger() {
  const events: SamplingLedgerEvent[] = [];
  return {
    emitter: {
      emit(e: SamplingLedgerEvent) {
        events.push(e);
      },
    },
    events,
  };
}

describe('SamplingOverrideWorkflow', () => {
  it('records draw events with seed + sizes', () => {
    const l = makeLedger();
    const wf = new SamplingOverrideWorkflow(l.emitter);
    wf.recordDraw({
      planId: PLAN.planId,
      method: 'random',
      seed: PLAN.seed,
      populationSize: 100,
      sampleSize: 5,
      confidence: 0.95,
      actorId: '00000000-0000-0000-0000-000000000001',
    });
    expect(l.events).toHaveLength(1);
    const e = l.events[0]!;
    if (e.kind === 'sampling.drawn') {
      expect(e.method).toBe('random');
      expect(e.seed).toBe(PLAN.seed);
      expect(e.confidence).toBe(0.95);
    }
  });

  it('swaps a unit for cause and emits an override event', () => {
    const pop = makePopulation(30);
    const sample = new RandomSampler().sample(pop, PLAN);
    const removed = sample[0]!.unitId;
    const present = new Set(sample.map((u) => u.unitId));
    const newCandidate = pop.units.find((u) => !present.has(u.id))!.id;

    const l = makeLedger();
    const wf = new SamplingOverrideWorkflow(l.emitter);
    const next = wf.swap({
      planId: PLAN.planId,
      population: pop,
      currentUnits: sample,
      removedUnitId: removed,
      addedUnitId: newCandidate,
      rationale: 'Original unit unavailable; auditor selected representative substitute.',
      actorId: '00000000-0000-0000-0000-000000000002',
    });

    expect(next.length).toBe(sample.length);
    expect(next.some((u) => u.unitId === removed)).toBe(false);
    expect(next.some((u) => u.unitId === newCandidate)).toBe(true);
    expect(l.events.some((e) => e.kind === 'sampling.overridden')).toBe(true);
  });

  it('rejects empty rationale', () => {
    const pop = makePopulation(10);
    const sample = new RandomSampler().sample(pop, PLAN);
    const l = makeLedger();
    const wf = new SamplingOverrideWorkflow(l.emitter);
    expect(() =>
      wf.swap({
        planId: PLAN.planId,
        population: pop,
        currentUnits: sample,
        removedUnitId: sample[0]!.unitId,
        addedUnitId: pop.units[8]!.id,
        rationale: '   ',
        actorId: '00000000-0000-0000-0000-000000000003',
      }),
    ).toThrowError(/rationale/);
  });

  it('rejects when removed unit not in sample', () => {
    const pop = makePopulation(10);
    const sample = new RandomSampler().sample(pop, PLAN);
    const wf = new SamplingOverrideWorkflow(makeLedger().emitter);
    expect(() =>
      wf.swap({
        planId: PLAN.planId,
        population: pop,
        currentUnits: sample,
        removedUnitId: 'not-in-sample',
        addedUnitId: pop.units[0]!.id,
        rationale: 'x',
        actorId: '00000000-0000-0000-0000-000000000003',
      }),
    ).toThrowError(/Removed unit/);
  });

  it('rejects when added unit already in sample', () => {
    const pop = makePopulation(10);
    const sample = new RandomSampler().sample(pop, PLAN);
    const wf = new SamplingOverrideWorkflow(makeLedger().emitter);
    expect(() =>
      wf.swap({
        planId: PLAN.planId,
        population: pop,
        currentUnits: sample,
        removedUnitId: sample[0]!.unitId,
        addedUnitId: sample[1]!.unitId,
        rationale: 'rationale',
        actorId: '00000000-0000-0000-0000-000000000003',
      }),
    ).toThrowError(/already in current sample/);
  });

  it('rejects when added unit not in population', () => {
    const pop = makePopulation(5);
    const sample = new RandomSampler().sample(pop, PLAN);
    const wf = new SamplingOverrideWorkflow(makeLedger().emitter);
    expect(() =>
      wf.swap({
        planId: PLAN.planId,
        population: pop,
        currentUnits: sample,
        removedUnitId: sample[0]!.unitId,
        addedUnitId: 'not-in-population',
        rationale: 'rationale',
        actorId: '00000000-0000-0000-0000-000000000003',
      }),
    ).toThrowError(/not in population/);
  });
});
