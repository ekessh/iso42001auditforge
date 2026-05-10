// SPDX-License-Identifier: BUSL-1.1
import { AuditForgeError } from '@auditforge/shared';
import { CostBudgetExceeded as PkgCostBudgetExceeded } from '@auditforge/cost-controller';
import {
  AirGapViolation as PkgAirGapViolation,
  CloudConsentRequired as PkgCloudConsentRequired,
} from '@auditforge/consent-registry';

export class ProviderHttpError extends AuditForgeError {
  constructor(provider: string, status: number, body: string) {
    super('PROVIDER_HTTP_ERROR', `${provider} returned ${status}: ${body}`, 502, {
      provider,
      status,
      body,
    });
  }
}

export class StructuredParseError extends AuditForgeError {
  constructor(provider: string, attempts: number, lastError: string) {
    super(
      'STRUCTURED_PARSE_ERROR',
      `${provider} failed to produce schema-valid output after ${attempts} attempts`,
      422,
      { provider, attempts, lastError },
    );
  }
}

// WHY: re-exports keep the historical import paths
// (`@auditforge/llm-provider` => `CostBudgetExceeded`) while letting the
// canonical implementation live in the dedicated cost-controller / consent
// packages.
export const CostBudgetExceeded = PkgCostBudgetExceeded;
export type CostBudgetExceeded = InstanceType<typeof PkgCostBudgetExceeded>;

export const AirGapViolation = PkgAirGapViolation;
export type AirGapViolation = InstanceType<typeof PkgAirGapViolation>;

export class ConsentMissingError extends PkgCloudConsentRequired {
  // WHY: shorter alias preserved for legacy throw sites; the canonical
  // CloudConsentRequired shape is unchanged.
  constructor(engagementId: string, providerName: string = 'cloud') {
    super(engagementId, providerName);
  }
}

export class TemplateMismatch extends AuditForgeError {
  constructor(declaredVersion: string, registryVersion: string | null) {
    super(
      'TEMPLATE_MISMATCH',
      `prompt template version ${declaredVersion} does not match registry (${registryVersion ?? 'unknown'})`,
      409,
      { declaredVersion, registryVersion },
    );
  }
}

export class TierRouterError extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('TIER_ROUTER_ERROR', message, 500, details);
  }
}
