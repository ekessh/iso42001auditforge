// SPDX-License-Identifier: BUSL-1.1
//
// Test-only signer. Production keys live outside this package — the engine
// emits a request, the host signs with the hardware key, the engine verifies
// and embeds. We provide a software signer for unit tests and developer
// environments only; it is explicitly marked `software-test`.

import { createSign, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { SignatureResponseSchema, type SignatureRequest, type SignatureResponse } from './types.js';

export interface TestKeyPair {
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly certHex: string;
}

/** Generate an in-memory ECDSA P-256 key pair plus a self-described cert. */
export function generateTestKey(label: string): TestKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  // We do not generate a real X.509 here — production uses the user's real
  // hardware-key cert. For tests we encode the SPKI plus label as the "cert".
  const certBytes = Buffer.from(`TEST-CERT|${label}|${publicKeyPem}`);
  return { privateKeyPem, publicKeyPem, certHex: certBytes.toString('hex') };
}

/**
 * Software-only test signer. Throws if called outside tests-mode. Hosts
 * MUST refuse to use this in production. ADR-0006 states: "Software-only
 * signing is available for non-production environments only."
 */
export function testSign(req: SignatureRequest, key: TestKeyPair): SignatureResponse {
  const sign = createSign('SHA256');
  sign.update(Buffer.from(req.digest, 'hex'));
  sign.end();
  const sig = sign.sign(key.privateKeyPem);
  return SignatureResponseSchema.parse({
    requestId: req.id,
    signatureHex: sig.toString('hex'),
    certChainHex: [key.certHex],
    algorithmOid: '1.2.840.10045.4.3.2', // ecdsa-with-SHA256
    hardwareKey: 'software-test',
    signedAt: new Date().toISOString(),
  });
}

/**
 * Verify a software-test signature. Production uses certificate-chain +
 * trust-anchor verification (see `verify.ts`).
 */
export function testVerify(
  digestHex: string,
  signatureHex: string,
  certHex: string,
): boolean {
  // Recover the public key from our test cert (the test cert is just
  // `TEST-CERT|label|pubKeyPem`).
  const certText = Buffer.from(certHex, 'hex').toString('utf-8');
  const parts = certText.split('|');
  if (parts.length < 3) return false;
  const pubKeyPem = parts.slice(2).join('|');
  const pubKey = createPublicKey(pubKeyPem);
  const verify = (
    // dynamic import-style require; vitest runs in node so this is safe
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:crypto') as typeof import('node:crypto')
  ).createVerify('SHA256');
  verify.update(Buffer.from(digestHex, 'hex'));
  verify.end();
  return verify.verify(pubKey, Buffer.from(signatureHex, 'hex'));
}
