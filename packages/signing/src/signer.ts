// SPDX-License-Identifier: BUSL-1.1

import { createHash } from 'node:crypto';
import { canonicalize, canonicalizeToBytes } from './jcs.js';
import type { SigningProvider } from './providers/provider.js';

export interface Receipt {
  readonly payloadHash: string;
  readonly prevHash: string | null;
  readonly signature: string;
  readonly signerId: string;
  readonly signerKeyId: string;
  readonly publicKeyBase64: string;
  readonly algorithm: 'Ed25519';
  readonly ts: string;
}

export interface SignReceiptOptions {
  readonly signerId: string;
  readonly prevHash?: string | null;
  readonly now?: () => string;
}

export class SigningService {
  constructor(private readonly provider: SigningProvider) {}

  async signCanonicalJson(value: unknown, opts: SignReceiptOptions): Promise<Receipt> {
    const canonical = canonicalizeToBytes(value);
    return this.signBytes(canonical, opts);
  }

  async signBytes(payload: Uint8Array, opts: SignReceiptOptions): Promise<Receipt> {
    const desc = await this.provider.describe();
    const payloadHash = sha256Hex(payload);
    const prevHash = opts.prevHash ?? null;
    const ts = (opts.now ?? (() => new Date().toISOString()))();
    // Sign the canonicalised receipt envelope (excluding the signature itself) so the receipt is self-verifying.
    const tbs = canonicalize({
      payloadHash,
      prevHash,
      signerId: opts.signerId,
      signerKeyId: desc.keyId,
      publicKeyBase64: desc.publicKeyBase64,
      algorithm: desc.algorithm,
      ts,
    });
    const sig = await this.provider.sign(new TextEncoder().encode(tbs));
    return {
      payloadHash,
      prevHash,
      signature: Buffer.from(sig).toString('base64'),
      signerId: opts.signerId,
      signerKeyId: desc.keyId,
      publicKeyBase64: desc.publicKeyBase64,
      algorithm: desc.algorithm,
      ts,
    };
  }

  async verifyReceipt(payload: Uint8Array, receipt: Receipt): Promise<boolean> {
    const expectedHash = sha256Hex(payload);
    if (expectedHash !== receipt.payloadHash) return false;
    const tbs = canonicalize({
      payloadHash: receipt.payloadHash,
      prevHash: receipt.prevHash,
      signerId: receipt.signerId,
      signerKeyId: receipt.signerKeyId,
      publicKeyBase64: receipt.publicKeyBase64,
      algorithm: receipt.algorithm,
      ts: receipt.ts,
    });
    return this.provider.verify(
      new TextEncoder().encode(tbs),
      Buffer.from(receipt.signature, 'base64'),
      receipt.publicKeyBase64,
    );
  }
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256')
    .update(typeof bytes === 'string' ? bytes : Buffer.from(bytes))
    .digest('hex');
}
