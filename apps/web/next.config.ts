// SPDX-License-Identifier: BUSL-1.1
import type { NextConfig } from 'next';
import { randomBytes } from 'node:crypto';

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
 *   Next.js 15 supports nonce-based CSP via middleware. A middleware at
 *   apps/web/middleware.ts (not created here) should call
 *   `generateNonce()` per request, set `x-nonce` on the response headers,
 *   and pass it to the CSP header via the `nonce` slot below.
 *   Server Components read the nonce from `headers()` and pass it to
 *   <Script nonce={nonce}> / <style nonce={nonce}>.
 *
 * Until the middleware is wired, a build-time nonce is used as a fallback.
 * This is weaker than per-request nonces but still removes 'unsafe-inline'.
 */

const BUILD_NONCE = randomBytes(16).toString('base64');
const NONCE_PLACEHOLDER = process.env.NEXT_PUBLIC_CSP_NONCE ?? BUILD_NONCE;

// Allow configuring the API origin via env (replaces localhost:4000 in prod).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');

// Toggle CSP report-only mode for gradual rollout.
const CSP_REPORT_ONLY = process.env.NEXT_PUBLIC_CSP_REPORT_ONLY === '1';

/** The CSP directive value. Exported for unit tests. */
export function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",

    // strict-dynamic + nonce: allows scripts loaded by the trusted nonce-bearing
    // inline loader to load further scripts. 'unsafe-inline' and 'unsafe-eval'
    // are intentionally absent.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self'`,

    // style-src: 'unsafe-inline' kept for Next.js CSS-in-JS (Tailwind global
    // styles injected via <style> tags). Narrow this to hashes or nonces once
    // all dynamic styles are moved to static CSS files.
    // TODO: replace 'unsafe-inline' with computed hashes once all inline
    //       <style> usage is catalogued.
    "style-src 'self' 'unsafe-inline'",

    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${API_ORIGIN} ${WS_ORIGIN}`,

    // Security directives.
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",

    // object-src / media-src: deny by default via default-src; explicit here
    // for defence-in-depth.
    "object-src 'none'",

    // Trusted Types (report-only until all inline eval is removed).
    // Un-comment the second line to enforce once all violations are resolved.
    // "require-trusted-types-for 'script'",
    // "trusted-types 'default'",
  ];

  return directives.join('; ');
}

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
  poweredByHeader: false,

  async headers() {
    const csp = buildCsp(NONCE_PLACEHOLDER);
    const cspHeaderName = CSP_REPORT_ONLY
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    return [
      {
        source: '/:path*',
        headers: [
          { key: cspHeaderName, value: csp },
          // Always ship the enforced header alongside report-only for belt-and-suspenders.
          ...(CSP_REPORT_ONLY
            ? [
                {
                  key: 'Content-Security-Policy',
                  value:
                    // Minimal enforced policy even in report-only mode —
                    // preserves clickjacking + form-action protections.
                    "default-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
                },
              ]
            : []),
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
