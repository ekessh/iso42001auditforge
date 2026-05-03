// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { IntegrityVerifier } from '../src/integrity.js';
import { bundleManifestRoot, leafHash } from '../src/merkle.js';
import type { AuditFileArchive } from '../src/domain.js';

const okSig = { verify: async () => true };
const okTsa = { verify: async () => true };
const badSig = { verify: async () => false };

function archive(merkleRoot: string): AuditFileArchive {
  return {
    id: 'a', firmId: 'f', engagementId: 'e',
    frozenAt: new Date().toISOString(), bundleManifestKey: 'k',
    merkleRoot,
    signatures: [{ signerId: 's', signerRole: 'lead_auditor', algorithm: 'ed25519', signedAt: new Date().toISOString(), signatureBase64: 'sig' }],
    tsaTokens: [{ authority: 't', issuedAt: new Date().toISOString(), tokenBase64: 'tok' }],
    retainUntil: new Date().toISOString(), status: 'active',
  };
}

describe('IntegrityVerifier', () => {
  it('passes for matching bundle', async () => {
    const bundle = [{ path: 'p', hash: leafHash('A') }];
    const root = bundleManifestRoot(bundle);
    const v = new IntegrityVerifier(okSig, okTsa);
    expect((await v.verify(archive(root), bundle)).ok).toBe(true);
  });
  it('detects tamper', async () => {
    const bundle = [{ path: 'p', hash: leafHash('A') }];
    const root = bundleManifestRoot(bundle);
    const v = new IntegrityVerifier(okSig, okTsa);
    const tampered = [{ path: 'p', hash: leafHash('A!') }];
    expect((await v.verify(archive(root), tampered)).ok).toBe(false);
  });
  it('detects bad signature', async () => {
    const bundle = [{ path: 'p', hash: leafHash('A') }];
    const root = bundleManifestRoot(bundle);
    const v = new IntegrityVerifier(badSig, okTsa);
    expect((await v.verify(archive(root), bundle)).ok).toBe(false);
  });
});
