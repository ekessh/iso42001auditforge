// SPDX-License-Identifier: BUSL-1.1
/**
 * CSP builder. Edge-runtime safe — no Node imports, no next/server deps.
 * NOTE: nonce parameter retained for future re-introduction of strict-dynamic.
 * Currently script-src ships 'unsafe-inline' because Netlify's edge middleware
 * does not propagate modified request headers to the SSR renderer, so inline
 * script tags are emitted without nonces.
 */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');

export function buildCsp(_nonce: string): string {
  void _nonce;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${API_ORIGIN} ${WS_ORIGIN}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}
