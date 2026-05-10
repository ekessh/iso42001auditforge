// SPDX-License-Identifier: BUSL-1.1

import { createHash, randomInt } from 'node:crypto';
import {
  ASN1_TAG,
  containsBytes,
  derBoolean,
  derInteger,
  derNull,
  derOctetString,
  derOid,
  derSequence,
  parseNode,
} from './asn1.js';

export const SHA256_OID = '2.16.840.1.101.3.4.2.1';

export interface TimeStampToken {
  readonly tokenBase64: string;
  readonly tsaUrl: string;
  readonly issuedAt: string;
  readonly hashAlgorithm: 'sha256';
  readonly messageImprintHex: string;
}

export interface TsaClient {
  stamp(payloadDigestHex: string): Promise<TimeStampToken>;
  verify(token: TimeStampToken, expectedDigestHex: string): Promise<boolean>;
}

export function buildTimestampRequest(messageImprint: Uint8Array, opts: { reqCert?: boolean; nonce?: number } = {}): Uint8Array {
  if (messageImprint.length !== 32) {
    throw new Error('buildTimestampRequest: SHA-256 messageImprint must be 32 bytes');
  }
  const algId = derSequence(derOid(SHA256_OID), derNull());
  const messageImprintSeq = derSequence(algId, derOctetString(messageImprint));
  const children: Uint8Array[] = [
    derInteger(1), // version
    messageImprintSeq,
  ];
  if (opts.nonce !== undefined) {
    children.push(derInteger(opts.nonce));
  }
  if (opts.reqCert === true) {
    children.push(derBoolean(true));
  }
  return derSequence(...children);
}

/**
 * Extract the message imprint hash from a TimeStampResp DER blob. The TSTInfo lives inside the eContent OCTET STRING of an embedded ContentInfo. Rather than doing a full ASN.1 walk, we look for the SHA-256 messageImprint pattern (algId + 32-byte OCTET STRING) and read the next OCTET STRING contents.
 */
export function extractMessageImprintHash(token: Uint8Array): Uint8Array | null {
  const sha256OidBytes = derOid(SHA256_OID);
  for (let i = 0; i < token.length - sha256OidBytes.length; i++) {
    let match = true;
    for (let j = 0; j < sha256OidBytes.length; j++) {
      if (token[i + j] !== sha256OidBytes[j]) { match = false; break; }
    }
    if (!match) continue;
    let p = i + sha256OidBytes.length;
    if (p < token.length && token[p] === ASN1_TAG.NULL && token[p + 1] === 0) {
      p += 2;
    }
    if (p >= token.length) continue;
    if (token[p] !== ASN1_TAG.OCTET_STRING) continue;
    try {
      const node = parseNode(token, p);
      if (node.length === 32) {
        return node.content.slice();
      }
    } catch {
      continue;
    }
  }
  return null;
}

export class StubTsaClient implements TsaClient {
  private readonly url: string;
  private readonly issuedAt: () => string;
  constructor(opts: { url?: string; issuedAt?: () => string } = {}) {
    this.url = opts.url ?? 'stub:local';
    this.issuedAt = opts.issuedAt ?? (() => new Date().toISOString());
  }
  async stamp(payloadDigestHex: string): Promise<TimeStampToken> {
    if (!/^[0-9a-f]{64}$/.test(payloadDigestHex)) {
      throw new Error('StubTsaClient: payloadDigestHex must be 32-byte SHA-256 hex');
    }
    const imprint = Buffer.from(payloadDigestHex, 'hex');
    const issuedAt = this.issuedAt();
    const issuedAtBytes = new TextEncoder().encode(issuedAt);
    const algId = derSequence(derOid(SHA256_OID), derNull());
    const tstInfo = derSequence(
      derInteger(1),
      derOid('1.2.3.4.5'),
      derSequence(algId, derOctetString(imprint)),
      derInteger(randomInt(1 << 30)),
      derOctetString(issuedAtBytes),
    );
    return {
      tokenBase64: Buffer.from(tstInfo).toString('base64'),
      tsaUrl: this.url,
      issuedAt,
      hashAlgorithm: 'sha256',
      messageImprintHex: payloadDigestHex,
    };
  }
  async verify(token: TimeStampToken, expectedDigestHex: string): Promise<boolean> {
    if (token.hashAlgorithm !== 'sha256') return false;
    const tokenBytes = Buffer.from(token.tokenBase64, 'base64');
    const imprint = extractMessageImprintHash(tokenBytes);
    if (imprint === null) return false;
    const expected = Buffer.from(expectedDigestHex, 'hex');
    if (imprint.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (imprint[i] !== expected[i]) return false;
    }
    return token.messageImprintHex === expectedDigestHex;
  }
}

export interface Rfc3161HttpClientOptions {
  readonly url: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly reqCert?: boolean;
}

export class Rfc3161HttpClient implements TsaClient {
  constructor(private readonly options: Rfc3161HttpClientOptions) {}

  async stamp(payloadDigestHex: string): Promise<TimeStampToken> {
    if (!/^[0-9a-f]{64}$/.test(payloadDigestHex)) {
      throw new Error('Rfc3161HttpClient: payloadDigestHex must be 32-byte SHA-256 hex');
    }
    const imprint = Buffer.from(payloadDigestHex, 'hex');
    const req = buildTimestampRequest(imprint, { reqCert: this.options.reqCert ?? true });
    const fetcher = this.options.fetchImpl ?? fetch;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.options.timeoutMs ?? 30_000);
    let resp: Response;
    try {
      resp = await fetcher(this.options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/timestamp-query' },
        body: new Blob([new Uint8Array(req)]),
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!resp.ok) {
      throw new Error(`TSA HTTP ${resp.status}: ${resp.statusText}`);
    }
    const ab = await resp.arrayBuffer();
    const tokenBytes = new Uint8Array(ab);
    if (!containsBytes(tokenBytes, imprint)) {
      throw new Error('TSA response does not contain expected message imprint');
    }
    return {
      tokenBase64: Buffer.from(tokenBytes).toString('base64'),
      tsaUrl: this.options.url,
      issuedAt: new Date().toISOString(),
      hashAlgorithm: 'sha256',
      messageImprintHex: payloadDigestHex,
    };
  }

  async verify(token: TimeStampToken, expectedDigestHex: string): Promise<boolean> {
    if (token.hashAlgorithm !== 'sha256') return false;
    if (token.messageImprintHex !== expectedDigestHex) return false;
    const bytes = Buffer.from(token.tokenBase64, 'base64');
    const imprint = extractMessageImprintHash(bytes);
    if (imprint === null) {
      const expected = Buffer.from(expectedDigestHex, 'hex');
      return containsBytes(bytes, expected);
    }
    const expected = Buffer.from(expectedDigestHex, 'hex');
    if (imprint.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (imprint[i] !== expected[i]) return false;
    }
    return true;
  }
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256')
    .update(typeof bytes === 'string' ? bytes : Buffer.from(bytes))
    .digest('hex');
}
