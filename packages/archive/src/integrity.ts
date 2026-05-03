// SPDX-License-Identifier: BUSL-1.1
import type { AuditFileArchive } from './domain.js';
import { bundleManifestRoot, type BundleEntry } from './merkle.js';

export interface IntegrityResult {
  ok: boolean;
  reasons: string[];
}

export interface SignatureVerifier {
  verify(merkleRoot: string, sig: AuditFileArchive['signatures'][number]): Promise<boolean>;
}

export interface TsaVerifier {
  verify(merkleRoot: string, token: AuditFileArchive['tsaTokens'][number]): Promise<boolean>;
}

export class IntegrityVerifier {
  constructor(
    private readonly sigVerifier: SignatureVerifier,
    private readonly tsaVerifier: TsaVerifier,
  ) {}

  async verify(archive: AuditFileArchive, currentBundle: BundleEntry[]): Promise<IntegrityResult> {
    const reasons: string[] = [];
    const recomputed = bundleManifestRoot(currentBundle);
    if (recomputed !== archive.merkleRoot) reasons.push('merkle root mismatch');
    for (const sig of archive.signatures) {
      const ok = await this.sigVerifier.verify(archive.merkleRoot, sig);
      if (!ok) reasons.push(`signature by ${sig.signerRole} failed`);
    }
    for (const token of archive.tsaTokens) {
      const ok = await this.tsaVerifier.verify(archive.merkleRoot, token);
      if (!ok) reasons.push(`TSA token from ${token.authority} failed`);
    }
    return { ok: reasons.length === 0, reasons };
  }
}
