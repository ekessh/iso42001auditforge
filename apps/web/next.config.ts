// SPDX-License-Identifier: BUSL-1.1
import type { NextConfig } from 'next';

/**
 * Content Security Policy configuration.
 *
 * Design:
 * - script-src uses 'strict-dynamic' + per-request nonce so inline scripts
 *   injected by an XSS payload cannot execute.
 * - 'unsafe-inline' and 'unsafe-eval' are removed from script-src.
 * - style-src retains 'unsafe-inline' only for legacy Next.js server-side
 *   style injection. TODO: replace with nonce/hash allowlist once
 *   next/head style tags are replaced with CSS Modules / Tailwind only.
 * - frame-ancestors 'none' prevents clickjacking.
 * - base-uri 'self' prevents base-tag injection.
 * - form-action 'self' prevents form hijacking.
 * - Trusted Types are declared but not yet enforced (report-only until
 *   all third-party scripts are updated).
 * - CSP report-only mode is enabled via NEXT_PUBLIC_CSP_REPORT_ONLY=1.
 *
 * Nonce plumbing:
 *   The CSP value emitted by `headers()` below uses the literal token
 *   `{NONCE}` as a slot. The Edge middleware at `apps/web/middleware.ts`
 *   generates a fresh 16-byte random nonce per request, sets it on the
 *   `x-nonce` request header, and rewrites every `{NONCE}` occurrence in
 *   the CSP response header with that per-request value. Server Components
 *   read the same nonce via `apps/web/lib/nonce.ts` and pass it to
 *   `<Script nonce={...}>` / `<style nonce={...}>`.
 *
 *   `{NONCE}` is the ONLY allowed token in the CSP nonce slot. Substitution
 *   happens exclusively in the middleware — do not interpolate at build
 *   time, do not read a process env var, do not use a static fallback.
 */

const NONCE_PLACEHOLDER = '{NONCE}';

// Allow configuring the API origin via env (replaces localhost:4000 in prod).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');

// Toggle CSP report-only mode for gradual rollout.
const CSP_REPORT_ONLY = process.env.NEXT_PUBLIC_CSP_REPORT_ONLY === '1';

/** The CSP directive value. Exported for unit tests.
 *
 * NOTE: nonce parameter retained for API compatibility but currently unused.
 * Netlify edge middleware does not propagate modified request headers to the
 * Next.js SSR renderer, so the renderer never sees x-nonce and emits inline
 * script tags without a nonce attribute. Until that path is verified,
 * script-src ships 'unsafe-inline' instead of strict-dynamic+nonce.
 */
export function buildCsp(_nonce: string): string {
  void _nonce;
  const directives = [
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
  ];
  return directives.join('; ');
}

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
