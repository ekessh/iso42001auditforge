// SPDX-License-Identifier: BUSL-1.1

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from 'node:crypto';
import { ConfigurationError, ValidationError } from '@auditforge/shared';
import type { KeyDescriptor, SigningProvider } from './provider.js';

export interface SoftwareSigningProviderOptions {
  readonly privateKeyBase64: string;
  readonly keyId: string;
}

export class SoftwareSigningProvider implements SigningProvider {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly keyId: string;
  private readonly publicKeyBase64: string;

  constructor(opts: SoftwareSigningProviderOptions) {
    if (!opts.privateKeyBase64) {
      throw new ConfigurationError('SoftwareSigningProvider: privateKeyBase64 required');
    }
    const der = Buffer.from(opts.privateKeyBase64, 'base64');
    if (der.length !== 48) {
      // Ed25519 PKCS#8 DER is 48 bytes; reject silently-wrong material early.
      throw new ConfigurationError(
        `SoftwareSigningProvider: expected 48-byte Ed25519 PKCS#8 DER (got ${der.length})`,
      );
    }
    this.privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    this.publicKey = createPublicKey(this.privateKey);
    const spki = this.publicKey.export({ format: 'der', type: 'spki' });
    this.publicKeyBase64 = Buffer.from(spki).toString('base64');
    this.keyId = opts.keyId;
  }

  static generate(keyId: string): { provider: SoftwareSigningProvider; privateKeyBase64: string } {
    const { privateKey } = generateKeyPairSync('ed25519');
    const der = privateKey.export({ format: 'der', type: 'pkcs8' });
    const privateKeyBase64 = Buffer.from(der).toString('base64');
    return {
      provider: new SoftwareSigningProvider({ privateKeyBase64, keyId }),
      privateKeyBase64,
    };
  }

  async describe(): Promise<KeyDescriptor> {
    return {
      keyId: this.keyId,
      publicKeyBase64: this.publicKeyBase64,
      algorithm: 'Ed25519',
      hardwareBacked: false,
    };
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const sig = nodeSign(null, Buffer.from(message), this.privateKey);
    return new Uint8Array(sig);
  }

  async verify(message: Uint8Array, signature: Uint8Array, publicKeyBase64?: string): Promise<boolean> {
    const pub = publicKeyBase64 === undefined
      ? this.publicKey
      : (() => {
          const der = Buffer.from(publicKeyBase64, 'base64');
          if (der.length !== 44) {
            throw new ValidationError(`Ed25519 SPKI must be 44 bytes (got ${der.length})`);
          }
          return createPublicKey({ key: der, format: 'der', type: 'spki' });
        })();
    return nodeVerify(null, Buffer.from(message), pub, Buffer.from(signature));
  }
}
