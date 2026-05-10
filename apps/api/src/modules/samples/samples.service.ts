// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  MonetaryUnitSampler,
  RandomSampler,
  RiskBasedSampler,
  SamplingOverrideWorkflow,
  StratifiedSampler,
  SystematicSampler,
  attributeSampleSize,
  musSampleSize,
  variableSampleSize,
  type MonetaryValuePort,
  type RiskScorePort,
  type SamplePopulation,
  type SampleUnit,
  type SamplingLedgerEvent,
  type SamplingMethod,
} from '@auditforge/sampling';
import type {
  CreateSamplesDto,
  DrawSampleDto,
  DrawSampleResultDto,
  OverrideSampleDto,
  SamplesDto,
  SizeCalculatorDto,
  SizeCalculatorResultDto,
  UpdateSamplesDto,
} from './dto.js';
import { SamplesRepository } from './samples.repository.js';
import { SamplingAdapter } from '../../adapters/sampling.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

class FixedRiskPort implements RiskScorePort {
  constructor(private readonly map: Record<string, number>) {}
  getScores(ids: ReadonlyArray<string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = this.map[id] ?? 0;
    return out;
  }
}

class FixedValuePort implements MonetaryValuePort {
  constructor(private readonly map: Record<string, number>) {}
  getValues(ids: ReadonlyArray<string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = this.map[id] ?? 0;
    return out;
  }
}

@Injectable()
export class SamplesService {
  constructor(
    private readonly repo: SamplesRepository,
    @Optional() @Inject(SamplingAdapter) private readonly adapter?: SamplingAdapter,
    @Optional() @Inject(AuditEngineAdapter) private readonly audit?: AuditEngineAdapter,
  ) {}

  create(firmId: string, dto: CreateSamplesDto): Promise<SamplesDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<SamplesDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: SamplesDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateSamplesDto): Promise<SamplesDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to sampling calculators. */
  sampling(): SamplingAdapter | null {
    return this.adapter ?? null;
  }

  async draw(args: { firmId: string; actorId: string; dto: DrawSampleDto }): Promise<DrawSampleResultDto> {
    const pop: SamplePopulation = {
      populationId: args.dto.population.populationId,
      category: args.dto.population.category,
      description: args.dto.population.description,
      units: args.dto.population.units,
    };
    const plan = { planId: args.dto.planId, size: args.dto.size, seed: args.dto.seed };
    let units: SampleUnit[] = [];
    const method: SamplingMethod = args.dto.method;
    if (method === 'random') {
      units = new RandomSampler().sample(pop, plan);
    } else if (method === 'systematic') {
      units = new SystematicSampler().sample(pop, plan);
    } else if (method === 'stratified') {
      units = new StratifiedSampler().sample(pop, plan);
    } else if (method === 'risk_based') {
      const port = new FixedRiskPort(
        Object.fromEntries(pop.units.map((u) => [u.id, u.riskScore ?? 0])),
      );
      units = await new RiskBasedSampler(port).sample(pop, plan);
    } else if (method === 'mus') {
      const port = new FixedValuePort(args.dto.values ?? {});
      units = new MonetaryUnitSampler(port).sample(pop, plan).units;
    } else {
      // judgmental: caller picks units; we just record the metadata.
      units = pop.units.slice(0, args.dto.size).map((u, i) => ({
        unitId: u.id,
        planId: args.dto.planId,
        selectionIndex: i,
        weight: 1,
        rationale: 'auditor-curated',
      }));
    }

    if (this.audit) {
      const wf = new SamplingOverrideWorkflow({
        emit: (event: SamplingLedgerEvent) => {
          // Fire-and-forget; swallow rejections to avoid unhandled promise
          // noise in tests. The audit-engine adapter logs failures
          // internally and the canonical persistence is the responsibility
          // of the api-side ledger adapter (Wave 4 Drizzle migration).
          void this.audit!.append({
            firmId: args.firmId,
            actorId: args.actorId,
            type: event.kind,
            entity: 'sampling',
            entityId: event.planId,
            payload: event as unknown as Record<string, unknown>,
          }).catch(() => undefined);
        },
      });
      wf.recordDraw({
        planId: args.dto.planId,
        method: args.dto.method,
        seed: args.dto.seed,
        populationSize: pop.units.length,
        sampleSize: units.length,
        confidence: args.dto.confidence,
        actorId: args.actorId,
      });
    }

    return {
      planId: args.dto.planId,
      method: args.dto.method,
      seed: args.dto.seed,
      populationSize: pop.units.length,
      sampleSize: units.length,
      units: units as DrawSampleResultDto['units'],
    };
  }

  override(args: {
    firmId: string;
    actorId: string;
    dto: OverrideSampleDto;
  }): { planId: string; units: SampleUnit[] } {
    const wf = new SamplingOverrideWorkflow({
      emit: (event: SamplingLedgerEvent) => {
        if (this.audit) {
          void this.audit
            .append({
              firmId: args.firmId,
              actorId: args.actorId,
              type: event.kind,
              entity: 'sampling',
              entityId: event.planId,
              payload: event as unknown as Record<string, unknown>,
            })
            .catch(() => undefined);
        }
      },
    });
    const next = wf.swap({
      planId: args.dto.planId,
      population: {
        populationId: args.dto.population.populationId,
        category: args.dto.population.category,
        description: args.dto.population.description,
        units: args.dto.population.units,
      },
      currentUnits: args.dto.currentUnits.map((u) => ({
        unitId: u.unitId,
        planId: u.planId,
        selectionIndex: u.selectionIndex,
        weight: u.weight,
        ...(u.stratum !== undefined ? { stratum: u.stratum } : {}),
      })),
      removedUnitId: args.dto.removedUnitId,
      addedUnitId: args.dto.addedUnitId,
      rationale: args.dto.rationale,
      actorId: args.actorId,
    });
    return { planId: args.dto.planId, units: next };
  }

  calculateSize(input: SizeCalculatorDto): SizeCalculatorResultDto {
    if (input.formula === 'attribute') {
      return {
        formula: 'attribute',
        size: attributeSampleSize({
          N: input.N,
          confidence: input.confidence,
          tolerableDeviationRate: input.tolerableDeviationRate,
          expectedDeviationRate: input.expectedDeviationRate,
        }),
      };
    }
    if (input.formula === 'variable') {
      return {
        formula: 'variable',
        size: variableSampleSize({
          N: input.N,
          confidence: input.confidence,
          populationStdDev: input.populationStdDev,
          tolerableMisstatement: input.tolerableMisstatement,
          expectedMisstatement: input.expectedMisstatement,
        }),
      };
    }
    return {
      formula: 'mus',
      size: musSampleSize({
        populationValue: input.populationValue,
        materiality: input.materiality,
        expectedMisstatement: input.expectedMisstatement,
        confidence: input.confidence,
      }),
    };
  }
}
