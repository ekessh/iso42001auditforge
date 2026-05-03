// SPDX-License-Identifier: BUSL-1.1
//
// RFC 3161 TSA token interface. Hosts plug in an HTTP-fetching TSA client
// (e.g. via `node-tsp`). The engine accepts an opaque `TsaClient` so it can
// run in tests with an in-memory fake.

import { TsaTokenSchema, type TsaToken } from './types.js';

export interface TsaClient {
  /**
   * Request a timestamp token over the given digest. Implementations must
   * not retry indefinitely — the engine controls retry policy.
   */
  stamp(digestHex: string, opts: { tsaUrl: string }): Promise<TsaToken>;
}

/**
 * In-memory TSA client used by tests. Produces deterministic tokens keyed
 * off `digestHex`. Marked clearly as test-only.
 */
export class TestTsaClient implements TsaClient {
  private counter = 0;
  constructor(
    private readonly tsaUrl = 'https://test.tsa.local/tsr',
    private readonly issuedAt: () => string = () => new Date().toISOString(),
  ) {}
  async stamp(digestHex: string, opts: { tsaUrl?: string }): Promise<TsaToken> {
    this.counter++;
    const url = opts.tsaUrl ?? this.tsaUrl;
    const tokenHex = Buffer.from(`tst-${this.counter}-${digestHex}`).toString('hex');
    const issuer = Buffer.from('test-tsa-cert').toString('hex');
    return TsaTokenSchema.parse({
      tokenHex,
      tsaUrl: url,
      issuedAt: this.issuedAt(),
      tsaCertChainHex: [issuer],
    });
  }
}
