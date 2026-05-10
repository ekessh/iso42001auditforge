// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  AirGapViolation,
  CloudConsentRequired,
  ConsentGuard,
  InMemoryConsentRegistry,
  type ConsentRecord,
} from '../src/index.js';

const ENG_A = '00000000-0000-4000-8000-000000000aaa';
const FIRM = '00000000-0000-4000-8000-000000000fff';
const USER = '00000000-0000-4000-8000-000000000111';

function record(partial: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: '00000000-0000-4000-8000-000000000111',
    firmId: FIRM,
    engagementId: ENG_A,
    grantedBy: USER,
    grantedAt: '2025-01-01T00:00:00.000Z',
    revokedAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    providers: ['anthropic'],
    purpose: 'Audit assistance',
    scope: { purposes: ['audit'], dataClassesPermitted: ['public'], redactionRequired: true, notes: '' },
    writtenConsentDocId: 'doc-1',
    ...partial,
  };
}

describe('ConsentGuard', () => {
  it('passes through for local providers', async () => {
    const reg = new InMemoryConsentRegistry();
    const g = new ConsentGuard({ airGap: false, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'ollama', isCloud: false, engagementId: ENG_A }),
    ).resolves.toBeUndefined();
  });

  it('throws CloudConsentRequired when no active record', async () => {
    const reg = new InMemoryConsentRegistry();
    const g = new ConsentGuard({ airGap: false, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(CloudConsentRequired);
  });

  it('allows when an active consent record matches', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record());
    const g = new ConsentGuard({ airGap: false, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).resolves.toBeUndefined();
  });

  it('rejects revoked record', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record({ revokedAt: '2025-06-01T00:00:00.000Z' }));
    const g = new ConsentGuard({ airGap: false, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(CloudConsentRequired);
  });

  it('rejects expired record', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record({ expiresAt: '2024-01-01T00:00:00.000Z' }));
    const g = new ConsentGuard({ airGap: false, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(CloudConsentRequired);
  });

  it('air-gap mode rejects ALL cloud regardless of consent', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record());
    const g = new ConsentGuard({ airGap: true, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(AirGapViolation);
  });

  it('rejects record that does not list the requested provider', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record({ providers: ['openai'] }));
    const g = new ConsentGuard({ airGap: false, registry: reg });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(CloudConsentRequired);
  });

  it('fromEnv honours AIR_GAP_MODE=1', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record());
    const g = ConsentGuard.fromEnv(reg, { AIR_GAP_MODE: '1' });
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).rejects.toBeInstanceOf(AirGapViolation);
  });

  it('fromEnv honours AIR_GAP_MODE unset', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record());
    const g = ConsentGuard.fromEnv(reg, {});
    await expect(
      g.assertCloudAllowed({ providerName: 'anthropic', isCloud: true, engagementId: ENG_A }),
    ).resolves.toBeUndefined();
  });

  it('list returns all records for an engagement', async () => {
    const reg = new InMemoryConsentRegistry();
    reg.put(record({ id: '00000000-0000-4000-8000-00000000aaa1' }));
    reg.put(record({ id: '00000000-0000-4000-8000-00000000aaa2', providers: ['openai'] }));
    expect((await reg.list(ENG_A)).length).toBe(2);
  });
});
