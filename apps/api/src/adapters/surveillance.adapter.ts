// SPDX-License-Identifier: BUSL-1.1
//
// Surveillance adapter — wires `@auditforge/surveillance` into the API.
//
// Provides:
//   - `TelemetryIngest` (signed, replay-protected, schema-validated, rate-limited).
//   - `ThresholdEvaluator` (alert thresholds with hysteresis).
//   - `RiskScoreEngine` (continuous risk re-scoring).
//   - `ScopeAdjuster` (surveillance scope adjustment).
//   - `IncidentWatch` (A.5.5).
//   - Tenant-scoped registry over the API DTO surface.
//
// TODO(integration): persist `StreamRegistry` + `NonceStore` + `DedupStore`
// to Postgres / Redis once the surveillance schema lands. Production must
// not lose nonce state across restarts (replay window guarantee).

import { Inject, Injectable } from '@nestjs/common';
import {
  InMemoryDedupStore,
  InMemoryStreamRegistry,
  InMemoryNonceStore,
  TelemetryIngest,
  TokenBucketRateLimiter,
  type SecretResolver,
} from '@auditforge/surveillance';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  SurveillanceDto,
  CreateSurveillanceDto,
  UpdateSurveillanceDto,
} from '../modules/surveillance/dto.js';

/** Permissive secret resolver — used until a Vault-backed resolver lands. */
class StubSecretResolver implements SecretResolver {
  resolve(): string { return 'placeholder-secret'; }
}

@Injectable()
export class SurveillanceAdapter {
  readonly streamRegistry = new InMemoryStreamRegistry();
  readonly nonceStore = new InMemoryNonceStore();
  readonly dedupStore = new InMemoryDedupStore();
  readonly rateLimiter = new TokenBucketRateLimiter();
  readonly telemetryIngest: TelemetryIngest;

  /** Replaceable secret resolver. */
  private secretResolver: SecretResolver = new StubSecretResolver();

  /** Tenant-scoped registry over the API DTO. */
  readonly registry: TenantScopedRegistry<SurveillanceDto, CreateSurveillanceDto, UpdateSurveillanceDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.telemetryIngest = new TelemetryIngest({
      registry: this.streamRegistry,
      secrets: { resolve: (id: string) => this.secretResolver.resolve(id) },
      rateLimiter: this.rateLimiter,
      nonceStore: this.nonceStore,
      dedupStore: this.dedupStore,
      onAccept: (payload) => {
        // Telemetry envelope — chain-link every accepted payload so the
        // ledger reflects continuous monitoring.
        void audit.append({
          firmId: payload.tenantId,
          actorId: 'system',
          type: 'surveillance.telemetry_accepted',
          entity: 'surveillance.payload',
          entityId: payload.id,
          payload: payload as unknown as Record<string, unknown>,
        });
      },
    });

    this.registry = new TenantScopedRegistry<SurveillanceDto, CreateSurveillanceDto, UpdateSurveillanceDto>(
      { entity: 'surveillance', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as SurveillanceDto,
      'Surveillance',
    );
  }

  setSecretResolver(r: SecretResolver): void { this.secretResolver = r; }
}
