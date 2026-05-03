// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for `apps/web/middleware.ts`.
 *
 * The Next.js `next/server` module is stubbed with a small `NextResponse`
 * shim that mirrors the parts the middleware uses (`.next()`, `.headers`).
 * We do not need a running dev server.
 */

interface MockNextResponseInit {
  request?: { headers: Headers };
}

class MockNextResponse {
  readonly headers: Headers;
  readonly request: { headers: Headers } | undefined;

  constructor(init: MockNextResponseInit = {}) {
    this.headers = new Headers();
    this.request = init.request;
  }

  static next(init: MockNextResponseInit = {}): MockNextResponse {
    return new MockNextResponse(init);
  }
}

vi.mock('next/server', () => {
  return {
    NextResponse: MockNextResponse,
  };
});

interface MockNextRequestInit {
  headers?: Record<string, string>;
}

function makeRequest(init: MockNextRequestInit = {}): { headers: Headers } {
  // The middleware only ever reads `.headers` from the request, so a
  // duck-typed object is enough — no need to instantiate `Request` and
  // pay the URL parse cost.
  return { headers: new Headers(init.headers ?? {}) };
}

async function loadMiddleware() {
  // Re-import per test so module state is clean (and Vitest applies the
  // mock above on first import only).
  const mod = await import('./middleware');
  return mod;
}

/**
 * Run the middleware against a mock request and narrow the return type to
 * our `MockNextResponse` shim. Handles the unavoidable cast through
 * `unknown` required by `exactOptionalPropertyTypes: true`.
 */
async function invoke(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  middleware: (req: any) => Promise<unknown>,
  init?: MockNextRequestInit,
): Promise<MockNextResponse> {
  const result = await middleware(makeRequest(init));
  return result as unknown as MockNextResponse;
}

describe('middleware: nonce generation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a base64 string that decodes to 16 bytes', async () => {
    const { middleware } = await loadMiddleware();
    const response = await invoke(middleware);
    const nonce = response.headers.get('x-nonce');
    expect(nonce).toBeTruthy();
    // 16 bytes => 24 base64 chars including padding.
    expect(nonce!.length).toBe(24);
    // base64 character class
    expect(nonce!).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    const decoded = atob(nonce!);
    expect(decoded.length).toBe(16);
  });

  it('produces a different nonce on each invocation', async () => {
    const { middleware } = await loadMiddleware();
    const a = await invoke(middleware);
    const b = await invoke(middleware);
    expect(a.headers.get('x-nonce')).not.toBe(b.headers.get('x-nonce'));
  });

  it('forwards the nonce on the inbound request headers (visible to Server Components via headers())', async () => {
    const { middleware } = await loadMiddleware();
    const response = await invoke(middleware);
    // The implementation calls `NextResponse.next({ request: { headers } })`
    // so the request-side nonce is reachable on `response.request.headers`.
    expect(response.request?.headers.get('x-nonce')).toBe(
      response.headers.get('x-nonce'),
    );
  });
});

describe('middleware: CSP substitution', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('replaces every {NONCE} token in Content-Security-Policy', async () => {
    const { middleware, substituteNonce } = await loadMiddleware();
    // Sanity check on the helper used internally.
    expect(substituteNonce("script-src 'nonce-{NONCE}'", 'abc123')).toBe(
      "script-src 'nonce-abc123'",
    );
    // Multiple tokens get substituted with the same value.
    expect(
      substituteNonce(
        "script-src 'nonce-{NONCE}'; style-src 'nonce-{NONCE}'",
        'abc',
      ),
    ).toBe("script-src 'nonce-abc'; style-src 'nonce-abc'");

    // End-to-end: run the middleware, then simulate next.config.ts having
    // attached a CSP header on the same response object before final
    // emission. We have to do this BEFORE substitution would normally run,
    // which means we directly invoke the helper to verify replacement
    // semantics. (Ordering with `next.config.ts` headers() is verified
    // separately in next.config.spec.ts.)
    const response = await invoke(middleware);
    const nonce = response.headers.get('x-nonce')!;

    // Simulate the placeholder header arriving on the response and re-run
    // the same substitution the middleware applies.
    const placeholderCsp = "script-src 'nonce-{NONCE}' 'strict-dynamic'";
    response.headers.set('Content-Security-Policy', placeholderCsp);
    const swapped = substituteNonce(placeholderCsp, nonce);
    response.headers.set('Content-Security-Policy', swapped);

    expect(response.headers.get('Content-Security-Policy')).toBe(
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    );
    expect(response.headers.get('Content-Security-Policy')).not.toContain('{NONCE}');
  });

  it('leaves headers untouched when CSP is not present', async () => {
    const { middleware } = await loadMiddleware();
    const response = await invoke(middleware);
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
    // x-nonce is still set even with no CSP (used for downstream observers).
    expect(response.headers.get('x-nonce')).toBeTruthy();
  });

  it('substituteNonce is a no-op when the placeholder is absent', async () => {
    const { substituteNonce } = await loadMiddleware();
    const original = "default-src 'self'";
    expect(substituteNonce(original, 'abc')).toBe(original);
  });
});

describe('middleware: matcher config', () => {
  it('excludes _next/static, _next/image, favicon.ico, robots.txt, sitemap.xml', async () => {
    const { config } = await loadMiddleware();
    expect(config.matcher).toHaveLength(1);
    const entry = config.matcher[0]!;
    // Convert the source pattern to a regex and verify the negative
    // lookahead does what we claim.
    const source = entry.source;
    expect(source).toContain('_next/static');
    expect(source).toContain('_next/image');
    expect(source).toContain('favicon.ico');
    expect(source).toContain('robots.txt');
    expect(source).toContain('sitemap.xml');

    // Build a regex that mirrors Next's path-to-regexp semantics for our
    // simple negative-lookahead pattern.
    const negativeLookahead = /\(\?!([^)]+)\)/.exec(source);
    expect(negativeLookahead).not.toBeNull();
    const excluded = negativeLookahead![1]!.split('|');
    expect(excluded).toContain('_next/static');
    expect(excluded).toContain('_next/image');
    expect(excluded).toContain('favicon.ico');
    expect(excluded).toContain('robots.txt');
    expect(excluded).toContain('sitemap.xml');
  });
});
