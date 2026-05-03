// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  AirGapViolation,
  ConsentGuard,
  ConsentMissingError,
  InMemoryConsentRepository,
} from '../src/index.js';

describe('ConsentGuard', () => {
  it('passes through for local providers without consent', async () => {
    const repo = new InMemoryConsentRepository();
    const guard = new ConsentGuard({ airGap: false, consentRepo: repo });
    await guard.assertCloudAllowed({
      providerName: 'ollama',
      isCloud: false,
      engagementId: randomUUID(),
    });
  });

  it('rejects cloud calls without a consentRecordId', async () => {
    const repo = new InMemoryConsentRepository();
    const guard = new ConsentGuard({ airGap: false, consentRepo: repo });
    await expect(
      guard.assertCloudAllowed({
        providerName: 'openai',
        isCloud: true,
        engagementId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ConsentMissingError);
  });

  it('rejects cloud calls with an unknown consentRecordId', async () => {
    const repo = new InMemoryConsentRepository();
    const guard = new ConsentGuard({ airGap: false, consentRepo: repo });
    await expect(
      guard.assertCloudAllowed({
        providerName: 'openai',
        isCloud: true,
        engagementId: randomUUID(),
        consentRecordId: 'consent-missing',
      }),
    ).rejects.toBeInstanceOf(ConsentMissingError);
  });

  it('rejects revoked consent', async () => {
    const repo = new InMemoryConsentRepository();
    repo.put({
      id: 'c1',
      engagementId: 'e1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: true,
    });
    const guard = new ConsentGuard({ airGap: false, consentRepo: repo });
    await expect(
      guard.assertCloudAllowed({
        providerName: 'openai',
        isCloud: true,
        engagementId: 'e1',
        consentRecordId: 'c1',
      }),
    ).rejects.toBeInstanceOf(ConsentMissingError);
  });

  it('rejects expired consent', async () => {
    const repo = new InMemoryConsentRepository();
    repo.put({
      id: 'c1',
      engagementId: 'e1',
      expiresAt: new Date(Date.now() - 1).toISOString(),
      revoked: false,
    });
    const guard = new ConsentGuard({ airGap: false, consentRepo: repo });
    await expect(
      guard.assertCloudAllowed({
        providerName: 'openai',
        isCloud: true,
        engagementId: 'e1',
        consentRecordId: 'c1',
      }),
    ).rejects.toBeInstanceOf(ConsentMissingError);
  });

  it('rejects consent record bound to a different engagement', async () => {
    const repo = new InMemoryConsentRepository();
    repo.put({
      id: 'c1',
      engagementId: 'eOther',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    });
    const guard = new ConsentGuard({ airGap: false, consentRepo: repo });
    await expect(
      guard.assertCloudAllowed({
        providerName: 'openai',
        isCloud: true,
        engagementId: 'e1',
        consentRecordId: 'c1',
      }),
    ).rejects.toBeInstanceOf(ConsentMissingError);
  });

  it('air-gap mode short-circuits and rejects every cloud call', async () => {
    const repo = new InMemoryConsentRepository();
    repo.put({
      id: 'c1',
      engagementId: 'e1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    });
    const guard = new ConsentGuard({ airGap: true, consentRepo: repo });
    await expect(
      guard.assertCloudAllowed({
        providerName: 'openai',
        isCloud: true,
        engagementId: 'e1',
        consentRecordId: 'c1',
      }),
    ).rejects.toBeInstanceOf(AirGapViolation);
  });

  it('air-gap mode still allows local providers', async () => {
    const repo = new InMemoryConsentRepository();
    const guard = new ConsentGuard({ airGap: true, consentRepo: repo });
    await guard.assertCloudAllowed({
      providerName: 'ollama',
      isCloud: false,
      engagementId: 'e1',
    });
  });
});
