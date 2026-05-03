// SPDX-License-Identifier: BUSL-1.1
import { AuditForgeError } from '@auditforge/shared';

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

export class CostBudgetExceeded extends AuditForgeError {
  constructor(engagementId: string, capUsd: number, attemptedUsd: number) {
    super(
      'COST_BUDGET_EXCEEDED',
      `engagement ${engagementId} budget cap ${capUsd} exceeded (attempted +${attemptedUsd})`,
      402,
      { engagementId, capUsd, attemptedUsd },
    );
  }
}

export class ConsentMissingError extends AuditForgeError {
  constructor(engagementId: string) {
    super('CONSENT_MISSING', `cloud LLM call requires active consent for engagement ${engagementId}`, 412, {
      engagementId,
    });
  }
}

export class AirGapViolation extends AuditForgeError {
  constructor(provider: string) {
    super('AIRGAP_VIOLATION', `cloud provider ${provider} blocked by air-gap mode`, 403, { provider });
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
