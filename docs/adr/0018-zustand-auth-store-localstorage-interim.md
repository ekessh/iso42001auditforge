# ADR-0018: zustand auth store with localStorage persist (interim)

- **Status**: Accepted (interim — superseded by httpOnly cookie session in Phase 11)
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, security review
- **Phase**: 6 (web app) → 11 (auth hardening)
- **Tags**: auth, web, zustand, security-debt

## Context

The Wave-1 web app needed a client-side store for the authenticated
auditor's session token, current firm, and active engagement context. The
TanStack Query layer needs the bearer token to attach to requests; the
sidebar needs the current firm to render the right engagement list; the
WebAuthn flow needs to remember the registered credential id between
attempts.

The long-term answer is an httpOnly, SameSite=Strict cookie session backed
by an opaque server-side store. That requires (a) a session table and
rotation policy on the API side, (b) CSRF protection on every state-mutating
endpoint, and (c) end-to-end credential refresh on the web side. None of
that was scoped into Wave-1.

We needed something that works for the demo and Pilot but is honest about
its security debt.

## Decision

Use a `zustand` store with the `persist` middleware backed by
`localStorage` for the auditor session, with three explicit constraints:

1. **The bearer token is never used for sensitive operations.** Report
   publish, finding promotion, and any tool with state mutation require
   either a WebAuthn challenge (re-auth) or a confirmation token minted by
   a UI consent flow.
2. **The store carries a server-issued expiry**, and the API rejects expired
   tokens with `401`; the web client clears the store on `401` and routes
   to `/auth/signin`.
3. **The store is wrapped in a typed boundary** (`packages/auth-core`
   exports a `WebAuthSession` type) so swapping the persistence backend in
   Phase 11 does not ripple through the app.

The persisted shape is minimal: `{ token, firmId, userId, expiresAt }`.
PII (name, email, role list) is never persisted; it is fetched on app boot
from `/v1/auth/me`. This limits the blast radius of an XSS-driven
localStorage exfiltration to "the attacker knows the auditor's firm id and
holds a token that expires within 30 minutes".

## Consequences

### Positive

- **Quick to ship.** zustand+persist is two dozen lines of code. We
  shipped Wave-1 on schedule.
- **Migration-friendly.** The `WebAuthSession` boundary means Phase 11
  can replace localStorage with `document.cookie`-backed reads without
  touching app code.
- **Honest about the debt.** This ADR plus the `mitigation-tracker` row
  (`docs/threat-model/mitigation-tracker.md`) make sure Phase 11 owners
  see the deferred work.

### Negative

- **XSS impact is higher than ideal.** A successful XSS can read the
  bearer token from `localStorage`. The CSP (ADR-0027) is the primary
  mitigation; sub-resource integrity on every script tag is the secondary.
- **No httpOnly protection** until Phase 11.

### Neutral

- We considered `sessionStorage` instead of `localStorage` to drop the
  token on tab close, but auditors routinely lose long-running work to a
  forced reload, and the UX cost outweighed the security gain at this
  threat level.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Cookie-backed session in Wave-1 | Server-side session table + rotation + CSRF tokens were not scoped; would have slipped Wave-1 by 1-2 weeks. |
| In-memory only (no persist) | Forces re-auth on every reload; auditors lose context on accidental refresh; UX deemed unacceptable. |
| IndexedDB | Not persistently encrypted by the browser; same XSS risk; more code; no benefit. |
| iframe-isolated auth worker | High complexity; CSP edge cases; not justified at this stage. |

## Compliance Implications

- **ISO 27001 A.9.4.2** (secure log-on procedures): the WebAuthn factor
  satisfies the "something you have" leg even with this token model;
  bearer tokens alone do not authenticate state-mutating actions.
- **ISO 42001 Clause 8.2.6** (auditing AI systems): all state-mutating
  actions require a fresh consent token, so a stolen bearer token cannot
  promote a finding or publish a report.

## Follow-Ups

- [ ] Phase 11: implement opaque httpOnly cookie session; remove
      localStorage persistence; this ADR moves to "Superseded" and the
      mitigation-tracker row closes.
- [ ] Phase 11: deprecate the bearer-token field in `/v1/auth/me`.
- [ ] Wave-3: add an e2e test that verifies the store is cleared on `401`.
- [ ] Wave-3: Semgrep rule to flag direct `localStorage.getItem('auth')`
      reads outside `packages/auth-core`.
