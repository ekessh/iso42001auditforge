// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import { FileFreezer } from '../src/freezer.js';
import { leafHash } from '../src/merkle.js';

function deps(opts: { alreadyFrozen?: boolean } = {}) {
  const events: string[] = [];
  return {
    snapshot: { collectBundle: vi.fn().mockResolvedValue([{ path: 'wp/1.json', hash: leafHash('x') }]) },
    signer: { requestSignatures: vi.fn().mockResolvedValue([{ signerId: 's1', signerRole: 'lead_auditor', algorithm: 'ed25519', signedAt: new Date().toISOString(), signatureBase64: 'sig' }]) },
    tsa: { stamp: vi.fn().mockResolvedValue({ authority: 'tsa.example', issuedAt: new Date().toISOString(), tokenBase64: 'tok' }) },
    store: { put: vi.fn().mockResolvedValue(undefined), isFrozen: vi.fn().mockResolvedValue(opts.alreadyFrozen ?? false) },
    ledger: { emit: vi.fn().mockImplementation(async (t: string) => { events.push(t); return { eventId: 'e' }; }) },
    events,
  };
}

describe('FileFreezer', () => {
  it('freezes engagement', async () => {
    const d = deps();
    const f = new FileFreezer(d.snapshot, d.signer, d.tsa, d.store, d.ledger);
    const archive = await f.freeze({
      archiveId: 'a1', firmId: 'f1', engagementId: 'e1',
      signers: [{ id: 's1', role: 'lead_auditor' }],
      retainUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      bundleManifestKey: 'bundle.json',
    });
    expect(archive.status).toBe('active');
    expect(d.events).toContain('archive.frozen');
  });
  it('rejects double freeze', async () => {
    const d = deps({ alreadyFrozen: true });
    const f = new FileFreezer(d.snapshot, d.signer, d.tsa, d.store, d.ledger);
    await expect(f.freeze({
      archiveId: 'a1', firmId: 'f1', engagementId: 'e1',
      signers: [{ id: 's1', role: 'lead_auditor' }],
      retainUntil: new Date().toISOString(), bundleManifestKey: 'b.json',
    })).rejects.toThrow(/already frozen/);
  });
});
