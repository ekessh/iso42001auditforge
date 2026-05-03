// SPDX-License-Identifier: BUSL-1.1
//
// AI-systems adapter — wires `@auditforge/ai-system-profiler` into the API.
//
// The package's `exports['./services']` map currently points at a
// `services/index.ts` that has not landed (the leaf services are present
// — registry, profiler, risk-classifier — but no aggregate barrel). Until
// it lands, this adapter re-exports the package's main barrel (which
// contains all type schemas) and provides setter-based service hooks so
// the host can plug in concrete `AiSystemRegistry` / `AiSystemProfiler` /
// `RiskClassificationHelper` instances when ready.
//
// TODO(integration): once `packages/ai-system-profiler/src/services/index.ts`
// ships, swap the type-erased setters for direct construction in the
// adapter's constructor.

import { Inject, Injectable } from '@nestjs/common';
import * as aiSystemProfilerPkg from '@auditforge/ai-system-profiler';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  AiSystemsDto,
  CreateAiSystemsDto,
  UpdateAiSystemsDto,
} from '../modules/ai-systems/dto.js';

@Injectable()
export class AiSystemsAdapter {
  /** Re-exported package types / schemas (everything in the package's main barrel). */
  readonly pkg = aiSystemProfilerPkg;

  /** Replaceable service instances — caller wires real ones via setters
   *  once the package's services barrel is available. */
  private profilerInstance: unknown = null;
  private riskClassifierInstance: unknown = null;
  private aiRegistryInstance: unknown = null;

  /** Tenant-scoped registry over the API DTO surface. */
  readonly registry: TenantScopedRegistry<AiSystemsDto, CreateAiSystemsDto, UpdateAiSystemsDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<AiSystemsDto, CreateAiSystemsDto, UpdateAiSystemsDto>(
      { entity: 'ai-system', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as AiSystemsDto,
      'AiSystems',
    );
  }

  /** Plug in the concrete `AiSystemRegistry` (when the services barrel ships). */
  setRegistry(r: unknown): void { this.aiRegistryInstance = r; }
  /** Plug in the concrete `AiSystemProfiler`. */
  setProfiler(p: unknown): void { this.profilerInstance = p; }
  /** Plug in the concrete `RiskClassificationHelper`. */
  setRiskClassifier(c: unknown): void { this.riskClassifierInstance = c; }

  /** Read-back accessors. */
  getRegistry(): unknown { return this.aiRegistryInstance; }
  getProfiler(): unknown { return this.profilerInstance; }
  getRiskClassifier(): unknown { return this.riskClassifierInstance; }
}
