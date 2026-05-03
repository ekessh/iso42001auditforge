// SPDX-License-Identifier: BUSL-1.1
import 'server-only';
import { headers } from 'next/headers';

/**
 * Server-only CSP nonce reader.
 *
 * Use ONLY inside Next.js 15 Server Components or Route Handlers. The nonce
 * is set per request by `apps/web/middleware.ts` on the `x-nonce` header.
 *
 * Pass the returned value into any `<Script nonce={...}>` or
 * `<style nonce={...}>` rendered by a Server Component so the inline tag
 * matches the per-request CSP `'nonce-...'` source expression.
 *
 * Throws when the header is missing — that means either the middleware did
 * not run for this path (check the matcher) or the function was invoked
 * from somewhere it should not be (e.g. a Client Component, a Server
 * Action that runs before middleware in some edge cases, or middleware
 * itself).
 *
 * @returns The base64-encoded 16-byte nonce for the current request.
 */
export async function getNonce(): Promise<string> {
  // `headers()` is async in Next.js 15. Calling it from a Client Component
  // throws a clear runtime error from Next itself, so we don't need our own
  // guard for that case — but we re-wrap the missing-header case to give a
  // more actionable message.
  const headerList = await headers();
  const nonce = headerList.get('x-nonce');
  if (!nonce) {
    throw new Error(
      '[nonce] x-nonce header missing on request. Ensure apps/web/middleware.ts is wired and that this code runs inside a Server Component or Route Handler (not a Client Component or middleware itself).',
    );
  }
  return nonce;
}
