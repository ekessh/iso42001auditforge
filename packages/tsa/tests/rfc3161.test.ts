// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Rfc3161HttpClient,
  StubTsaClient,
  buildTimestampRequest,
  extractMessageImprintHash,
  sha256Hex,
} from '../src/index.js';

describe('buildTimestampRequest', () => {
  it('builds a SEQUENCE that contains the message imprint bytes', () => {
    const imprint = createHash('sha256').update('hello').digest();
    const req = buildTimestampRequest(imprint, { reqCert: true, nonce: 12345 });
    expect(req[0]).toBe(0x30);
    let found = false;
    for (let i = 0; i <= req.length - 32; i++) {
      let m = true;
      for (let j = 0; j < 32; j++) {
        if (req[i + j] !== imprint[j]) { m = false; break; }
      }
      if (m) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('rejects non-32-byte digests', () => {
    expect(() => buildTimestampRequest(new Uint8Array(20))).toThrow();
  });
});

describe('StubTsaClient', () => {
  it('round-trips stamp and verify', async () => {
    const c = new StubTsaClient({ url: 'stub:test' });
    const digest = sha256Hex('payload');
    const token = await c.stamp(digest);
    expect(token.hashAlgorithm).toBe('sha256');
    expect(token.tsaUrl).toBe('stub:test');
    expect(await c.verify(token, digest)).toBe(true);
  });

  it('verify rejects mismatched digest', async () => {
    const c = new StubTsaClient();
    const token = await c.stamp(sha256Hex('a'));
    expect(await c.verify(token, sha256Hex('b'))).toBe(false);
  });

  it('extractMessageImprintHash recovers imprint from stub token', async () => {
    const c = new StubTsaClient();
    const digest = sha256Hex('m');
    const token = await c.stamp(digest);
    const bytes = Buffer.from(token.tokenBase64, 'base64');
    const imprint = extractMessageImprintHash(bytes);
    expect(imprint).not.toBeNull();
    expect(Buffer.from(imprint!).toString('hex')).toBe(digest);
  });

  it('rejects malformed digest', async () => {
    const c = new StubTsaClient();
    await expect(c.stamp('not-hex')).rejects.toThrow();
  });
});

describe('Rfc3161HttpClient with mocked fetch', () => {
  it('posts and stores the response bytes', async () => {
    const stub = new StubTsaClient();
    const digest = sha256Hex('http-test');
    const fakeToken = await stub.stamp(digest);
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(String(url)).toBe('https://test.tsa.local/tsr');
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/timestamp-query');
      const body = new Uint8Array((init!.body as Uint8Array));
      // Echo a "response" that simply contains the imprint bytes — verify() falls back to substring scan.
      const tokenBytes = Buffer.from(fakeToken.tokenBase64, 'base64');
      void body;
      return new Response(tokenBytes, { status: 200 });
    };
    const c = new Rfc3161HttpClient({ url: 'https://test.tsa.local/tsr', fetchImpl });
    const tok = await c.stamp(digest);
    expect(tok.tsaUrl).toBe('https://test.tsa.local/tsr');
    expect(await c.verify(tok, digest)).toBe(true);
    expect(await c.verify(tok, sha256Hex('other'))).toBe(false);
  });

  it('throws on non-2xx', async () => {
    const fetchImpl: typeof fetch = async () => new Response('boom', { status: 503, statusText: 'no' });
    const c = new Rfc3161HttpClient({ url: 'https://test.tsa.local/tsr', fetchImpl });
    await expect(c.stamp(sha256Hex('x'))).rejects.toThrow(/TSA HTTP 503/);
  });

  it('throws when response does not contain the imprint', async () => {
    const fetchImpl: typeof fetch = async () => new Response(new Uint8Array(8), { status: 200 });
    const c = new Rfc3161HttpClient({ url: 'https://test.tsa.local/tsr', fetchImpl });
    await expect(c.stamp(sha256Hex('y'))).rejects.toThrow(/imprint/);
  });
});
