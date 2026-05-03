// SPDX-License-Identifier: BUSL-1.1
import { sha256Hex } from './hash.js';

export interface TsaToken {
  readonly token: string;
  readonly issuedAt: string;
  readonly algorithm: 'sha256';
  readonly placeholder: true;
}

export interface TsaProvider {
  sign(payloadDigestHex: string): Promise<TsaToken>;
  verify(payloadDigestHex: string, token: TsaToken): Promise<boolean>;
}

export class StubTsaProvider implements TsaProvider {
  constructor(private readonly providerId: string = 'stub:phase12-todo') {}

  async sign(payloadDigestHex: string): Promise<TsaToken> {
    const issuedAt = new Date().toISOString();
    const token = sha256Hex(this.providerId, '|', issuedAt, '|', payloadDigestHex);
    return { token, issuedAt, algorithm: 'sha256', placeholder: true };
  }

  async verify(payloadDigestHex: string, token: TsaToken): Promise<boolean> {
    const expected = sha256Hex(this.providerId, '|', token.issuedAt, '|', payloadDigestHex);
    return expected === token.token;
  }
}
