// SPDX-License-Identifier: BUSL-1.1
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from './next.config';

/**
 * Per-request CSP nonce middleware.
 *
 * Generates a cryptographically random 16-byte nonce per request, exposes it
 * to Server Components via the `x-nonce` request header, and substitutes the
 * literal `{NONCE}` placeholder in any `Content-Security-Policy` (and
 * `Content-Security-Policy-Report-Only`) response header value emitted by
 * `next.config.ts` with the per-request nonce.
 *
 * Edge-runtime safe: uses Web Crypto only (no `node:crypto`).
 *
 * Why this exists:
 *   `next.config.ts` ships a build-time placeholder of `{NONCE}` so the same
 *   policy text can be re-used across requests. This middleware turns that
 *   placeholder into a real per-request nonce. Reading the nonce inside
 *   Server Components is done via `apps/web/lib/nonce.ts`.
 */

const NONCE_BYTES = 16;

/**
 * Browser-safe base64 encoder for a small Uint8Array. Avoids `Buffer` so
 * the bundle stays edge-runtime compatible.
 */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // `btoa` is available in the Edge runtime.
  return btoa(binary);
}

function generateNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

/**
 * Substitute every literal `{NONCE}` token in a header value with the
 * supplied per-request nonce. Returns the original string unchanged if no
 * token is present.
 */
export function substituteNonce(headerValue: string, nonce: string): string {
  return headerValue.replace(/\{NONCE\}/g, nonce);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = generateNonce();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Echo the nonce on the outgoing response too — useful for debugging and
  // for downstream caches that need to vary on it. Kept lowercase to match
  // the request-side convention.
  response.headers.set('x-nonce', nonce);

  const csp = buildCsp(nonce);
  const reportOnly = process.env.NEXT_PUBLIC_CSP_REPORT_ONLY === '1';
  response.headers.set(
    reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    csp,
  );

  return response;
}

export const config = {
  // Skip Next static asset paths and well-known files. Without this, every
  // image / chunk fetch would invoke the middleware and pay the nonce-gen
  // cost. The negative lookahead is the canonical Next.js 15 pattern.
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
