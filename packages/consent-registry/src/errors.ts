// SPDX-License-Identifier: BUSL-1.1
import { AuditForgeError } from '@auditforge/shared';

export class CloudConsentRequired extends AuditForgeError {
  constructor(engagementId: string, providerName: string) {
    super(
      'CLOUD_CONSENT_REQUIRED',
      `cloud LLM call requires active written consent for engagement ${engagementId} on provider ${providerName}`,
      412,
      { engagementId, providerName },
    );
  }
}

export class AirGapViolation extends AuditForgeError {
  constructor(providerName: string) {
    super(
      'AIRGAP_VIOLATION',
      `cloud provider ${providerName} blocked by air-gap mode`,
      403,
      { providerName },
    );
  }
}
