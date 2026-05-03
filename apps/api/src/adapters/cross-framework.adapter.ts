// SPDX-License-Identifier: BUSL-1.1
//
// Cross-framework adapter — wires `@auditforge/cross-framework` into the API.
//
// Provides:
//   - `MappingRegistry` (framework-to-framework mapping graph).
//   - `computeCoverage` (transitive coverage calculator).
//   - Tenant-scoped registry over the API DTO surface.
//
// When the coverage methodology mutates (weight changes, mapping additions,
// SME sign-off), the adapter emits a `cross-framework.weight_config_changed`
// event via the audit-engine adapter so methodology changes are part of the
// chain (mandatory per ADR-0013 / Phase 8 dashboard requirements).
//
// TODO(integration): load `initial-mappings.json` from
// `@auditforge/cross-framework` at boot once the package ships a runtime
// JSON loader. Until then, callers seed the registry via `addMapping`.

import { Inject, Injectable } from '@nestjs/common';
import {
  MappingRegistry,
  computeCoverage,
  type FrameworkMapping,
} from '@auditforge/cross-framework';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  CrossFrameworkDto,
  CreateCrossFrameworkDto,
  UpdateCrossFrameworkDto,
} from '../modules/cross-framework/dto.js';

@Injectable()
export class CrossFrameworkAdapter {
  /** Per-firm graph registries — keyed by firmId. */
  private readonly registries = new Map<string, MappingRegistry>();

  /** Pure helpers exposed for the service layer. */
  readonly coverage = { compute: computeCoverage };

  /** Tenant-scoped registry over the API DTO surface. */
  readonly registry: TenantScopedRegistry<CrossFrameworkDto, CreateCrossFrameworkDto, UpdateCrossFrameworkDto>;

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<CrossFrameworkDto, CreateCrossFrameworkDto, UpdateCrossFrameworkDto>(
      { entity: 'cross-framework', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as CrossFrameworkDto,
      'CrossFramework',
    );
  }

  /** Get-or-create the per-firm `MappingRegistry`. */
  registryFor(firmId: string): MappingRegistry {
    let r = this.registries.get(firmId);
    if (!r) {
      r = new MappingRegistry([]);
      this.registries.set(firmId, r);
    }
    return r;
  }

  /** Add a mapping to a firm's graph. Emits a methodology-change event. */
  async addMapping(firmId: string, mapping: FrameworkMapping, actorId = 'system'): Promise<void> {
    this.registryFor(firmId).add(mapping);
    await this.audit.append({
      firmId,
      actorId,
      type: 'cross-framework.mapping_added',
      entity: 'cross-framework.mapping',
      entityId: mapping.id,
      payload: {
        source: mapping.source,
        target: mapping.target,
        relationship: mapping.relationship,
        confidence: mapping.confidence,
      },
    });
  }

  /**
   * Emit a methodology-change event when the weight configuration mutates.
   * Per the v3 dashboard methodology rule, weight changes are explicit and
   * logged; this hook is the single place that does it.
   */
  async emitWeightConfigChanged(
    firmId: string,
    actorId: string,
    diff: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.append({
      firmId,
      actorId,
      type: 'cross-framework.weight_config_changed',
      entity: 'cross-framework.methodology',
      entityId: firmId,
      payload: diff,
    });
  }
}
