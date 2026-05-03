// SPDX-License-Identifier: BUSL-1.1
//
// Sampling adapter — wires `@auditforge/sampling` into the API.
//
// Provides:
//   - `SampleSizeCalculator` (size rules + risk-weighted overlay).
//   - `RandomSampler`           (uniform, deterministic via seed).
//   - `StratifiedSampler`       (proportional allocation, per-stratum substreams).
//   - `RiskBasedSampler`        (Efraimidis-Spirakis weighted reservoir).
//   - `JudgmentalSamplingHelper`(auditor-curated, rationale per pick).
//   - `DistributionAuditor`     (chi-square goodness-of-fit on actual selections).
//   - Tenant-scoped registry over the API DTO surface.
//
// Calculators / samplers are pure — re-exported as singletons.

import { Inject, Injectable } from '@nestjs/common';
import {
  DistributionAuditor,
  JudgmentalSamplingHelper,
  RandomSampler,
  RiskBasedSampler,
  SampleSizeCalculator,
  StratifiedSampler,
  SeededRng,
  type RiskScorePort,
} from '@auditforge/sampling';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { SamplesDto, CreateSamplesDto, UpdateSamplesDto } from '../modules/samples/dto.js';

/** Default empty risk-score port — caller supplies a real one via the
 *  factory method when running risk-weighted sampling. */
class EmptyRiskScorePort implements RiskScorePort {
  getScores(unitIds: ReadonlyArray<string>): Record<string, number> {
    return Object.fromEntries(unitIds.map((id) => [id, 0]));
  }
}

@Injectable()
export class SamplingAdapter {
  readonly sizeCalculator = new SampleSizeCalculator();
  readonly randomSampler = new RandomSampler();
  readonly stratifiedSampler = new StratifiedSampler();
  /** Default risk-based sampler with a zero-risk port; build your own via
   *  `riskSampler(port)` when wiring `@auditforge/risks`. */
  readonly riskBasedSampler = new RiskBasedSampler(new EmptyRiskScorePort());
  readonly judgmentalHelper = new JudgmentalSamplingHelper();
  readonly distributionAuditor = new DistributionAuditor();

  /** Build a risk-weighted sampler bound to a caller-supplied score port. */
  riskSampler(port: RiskScorePort): RiskBasedSampler {
    return new RiskBasedSampler(port);
  }
  /** Build a seeded RNG with a caller-supplied seed (deterministic). */
  seededRng(seed: string): SeededRng {
    return new SeededRng(seed);
  }

  readonly registry: TenantScopedRegistry<SamplesDto, CreateSamplesDto, UpdateSamplesDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<SamplesDto, CreateSamplesDto, UpdateSamplesDto>(
      { entity: 'sample', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as SamplesDto,
      'Samples',
    );
  }
}
