# ADR-0027: CSP relaxation to 'unsafe-inline' as Netlify-compat interim

- **Status**: Accepted (interim — superseded by per-request nonce, see Follow-Ups)
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, security review, web lead
- **Phase**: 6 (web app) → 11 (auth & security hardening)
- **Tags**: csp, security-debt, netlify, web

## Context

Wave-1 deployed `apps/web` (Next.js 15 + Tailwind + shadcn/ui) to
Netlify. Next.js 15 emits inline `<script>` tags for hydration data
and inline styles in production builds. The strict CSP we wanted —
`script-src 'self' 'strict-dynamic' 'nonce-XXX'; style-src 'self'
'nonce-XXX'` — requires a per-request nonce injected into both the
HTML response *and* the CSP header. Netlify's edge layer rewrote our
CSP responses on the static-asset path and stripped the nonce, breaking
hydration on production.

Two paths were possible:

1. Move off Netlify (e.g. self-host on Cloudflare Pages or Vercel).
2. Relax CSP to `'unsafe-inline'` for `script-src` and `style-src` as
   a temporary measure, with a tracked path back to a strict CSP via
   the per-request nonce middleware.

A recent commit on `main` (`d66f424 fix(web): per-request CSP nonces
via Next.js middleware`) implemented the **nonce middleware** in
preparation for tightening. ADR-0027 documents the intermediate state
and the path back.

## Decision

For Pilot deployment, set the CSP to:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self' wss://api.example.com https://api.example.com;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests;
```

**Compensating controls** in place:

- **`frame-ancestors 'none'`** — clickjacking still prevented.
- **`object-src 'none'`** — Flash / plugin code paths blocked.
- **`base-uri 'self'`** — `<base>` injection cannot redirect relative
  URLs to attacker domains.
- **WebAuthn** is the primary auth factor (see ADR-0018 for the
  bearer-token interim).
- **Subresource Integrity** on every external `<script>` (we host
  none today; the policy holds for the day we do).
- **Server-side input sanitization** for any user content rendered
  into the DOM.

The nonce middleware (referenced commit `d66f424`) is in place but
disabled by feature flag (`NEXT_PUBLIC_STRICT_CSP=1`) until we move
off Netlify or its edge stops mangling the header.

## Consequences

### Positive

- **Pilot ships.** No deployment platform change blocked Wave-1.
- **The way back exists.** The middleware is already written; flipping
  the feature flag is the unblock.

### Negative

- **XSS payload of `<script>...</script>` succeeds** if it lands on
  the page. We mitigate at the input layer (sanitize), at the
  framework layer (React's escaping), and at the auth layer (a stolen
  bearer token cannot promote a finding without a fresh consent
  token). Combined with `frame-ancestors 'none'`, the residual risk
  is "an attacker can read auditor PII and bearer token via
  reflected XSS" — non-trivial but bounded.
- **`unsafe-eval` permits `eval()` and `new Function()`**. We assert
  via Semgrep (`semgrep/free-form-llm-output.yml` rule library) that
  no first-party code uses those primitives; only third-party deps
  may.

### Neutral

- We considered moving off Netlify before Pilot. The platform
  switch carries operational risk that outweighed the CSP improvement
  at this stage.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Move to Cloudflare Pages now | Operational disruption mid-Wave-1; deferred to Phase 11. |
| Disable CSP entirely | Worse than relaxed; loses `frame-ancestors`. |
| Inline-only CSP (no nonce, no unsafe) | Breaks Next.js hydration on Netlify. |
| Hash-only CSP | Hashes change on every Tailwind build; not maintainable. |

## Compliance Implications

- **OWASP ASVS V14.4** (HTTP security headers): `frame-ancestors`,
  `base-uri`, `object-src` are strict; `script-src` is documented
  as a known interim weakness with a tracked remediation date.
- **ISO 27001 A.14.1.3** (protecting application services
  transactions): TLS 1.3 + HSTS in place independently of this ADR.

## Follow-Ups

- [ ] Phase 11: validate the per-request nonce middleware on a
      non-Netlify environment (Cloudflare Pages staging).
- [ ] Phase 11: flip `NEXT_PUBLIC_STRICT_CSP=1` in production and
      remove `'unsafe-inline'` / `'unsafe-eval'` from `script-src`.
- [ ] Phase 11: this ADR moves to "Superseded" once the strict CSP
      is live and verified by `tests/security/csp-headers.spec.ts`.
- [ ] Wave-3: Semgrep rule (`semgrep/free-form-llm-output.yml` family)
      flags any first-party use of `eval` or `new Function`.
