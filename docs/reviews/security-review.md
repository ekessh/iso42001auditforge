# Security Review (Date: 2026-05-03)

Scope: AuditForge ISO 42001 monorepo. Read-only review of tenancy, AuthN/AuthZ, crypto/signing, file upload, probe sandbox, LLM defenses, input validation, secrets, transport headers, CI/CD, GDPR posture, and STRIDE threat-model coverage.

## Executive Summary

- **Overall posture: Needs work.** The cryptographic primitives, Zod-typed event registry, dual-hash evidence model, fenced LLM input pattern, RBAC matrix in `packages/auth-core`, multi-signer / Merkle / LTV scaffolding, and Helm `NetworkPolicy` + ExternalSecrets templates are all *well-designed*. However the *runtime wiring* in `apps/api` and `apps/worker` is dominated by stubs that turn several spec-level guarantees into open holes if shipped as-is. Most critically, the API mounts a **header-trusting authentication middleware globally with no production guard**, and the database has **zero RLS policy migrations** in-tree despite RLS being the second leg of the documented defense-in-depth tenancy model.
- **Blockers: 5**
- **Highs: 8**
- **Mediums: 9**
- **Informational: 6**

## Findings

### BLOCKER #1 — Header-trusting `DevAuthMiddleware` is wired into the global request pipeline with no environment guard

- File: `apps/api/src/common/dev-auth.middleware.ts:10-30` and `apps/api/src/app.module.ts:111-113`
- Issue: `DevAuthMiddleware` reads `x-test-firm-id`, `x-test-auditor-id`, `x-test-roles`, `x-test-engagement-id`, and `x-webauthn-attestation` straight from request headers and writes them onto `req.auth` with **no signature, no JWT verification, and no `NODE_ENV` check**. `AppModule.configure()` then mounts it for every route via `consumer.apply(DevAuthMiddleware, RlsContextMiddleware).forRoutes('*')`. Any unauthenticated caller on the network can supply these headers and become any auditor of any firm with any role (including `super_admin`). Every downstream control — `AuthGuard`, `RbacGuard`, the audit-trail interceptor, RLS session vars, throttler tracker — derives its decision from this attacker-controlled `req.auth`.
- Impact: Complete authentication and authorization bypass; cross-tenant read/write; forged audit-ledger events under any auditor identity; complete defeat of the AuthForge security model in any environment that ships this build.
- Recommendation: (a) Make this middleware compile out unless `NODE_ENV !== 'production'`, ideally guarded both at registration time in `AppModule.configure()` (skip the `DevAuthMiddleware` in the `apply(...)` chain when `process.env.NODE_ENV === 'production'`) **and** inside the middleware itself (throw on any non-test environment). (b) Add a startup assertion in `apps/api/src/main.ts` that refuses to boot in production if any test-only middleware is registered. (c) Add an integration test that asserts `x-test-firm-id` is *not* honoured when `NODE_ENV=production`. (d) Replace it with a real `JwtSessionMiddleware` that validates a signed cookie/JWT against the keys in `auth-core/jwt.ts`.
- Owner: `apps/api` (`common/dev-auth.middleware.ts`, `app.module.ts`)

### BLOCKER #2 — No RLS migrations exist; the database half of ADR-0003's defense-in-depth tenancy model is unimplemented

- File: `packages/db/drizzle/` (directory empty), `packages/db/src/schema/` (only `_shared.ts`, `firms.ts`, `auditors.ts`), `infra/postgres-init/01-extensions.sql:1-9`, `docs/adr/0003-postgres-rls-tenancy.md:14-22`
- Issue: ADR-0003 promises a defense-in-depth model in which app-layer guards plus Postgres RLS each independently prevent cross-firm leakage. `packages/db/README.md:25-27` references `0001_rls_policies.sql` and `0002_init_schema.sql`. Neither file (nor any other `*.sql`) exists outside `infra/postgres-init/01-extensions.sql`. `packages/tenancy-core/src/context.ts:21` calls `SELECT set_tenant_context($1::uuid, $2::uuid)` and `BaseRepository.withTenant()` (`apps/api/src/db/base.repository.ts:22-25`) issues `SET LOCAL app.current_firm_id = ${ctx.firmId}` — but no `set_tenant_context` function, no `app_request_role`/`app_service_role`, and no `ENABLE ROW LEVEL SECURITY` exist in the codebase.
- Impact: The RLS leg is empty. The only thing standing between an app-layer query bug and cross-firm data exposure is the in-memory filter in repositories like `EvidenceRepository` (`apps/api/src/modules/evidence-vault/evidence-vault.repository.ts:31-45`). The "RLS bypass" test in `tests/security/suites/tenant-isolation.test.ts:1-37` only filters an in-memory array — it does not exercise the database at all.
- Recommendation: (a) Add hand-written migrations `0001_rls_roles.sql` (creating `app_service_role`/`app_request_role`, `set_tenant_context()`, `clear_tenant_context()`) and `0002_rls_policies.sql` enabling RLS on every business table with `USING (firm_id = current_setting('app.current_firm_id')::uuid)`. (b) Force-RLS owner-bypass with `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. (c) Wire the api Postgres pool to connect as `app_request_role` (`apps/api/src/db/db.module.ts:20-24`). (d) Rewrite `tests/security/suites/tenant-isolation.test.ts` to run against a real ephemeral Postgres (Testcontainers) and confirm cross-firm SELECT returns zero rows even with a missing app-layer filter.
- Owner: `packages/db`, `apps/api/src/db`

### BLOCKER #3 — `IdentityService` is a stub: WebAuthn responses are never verified, OIDC `code` exchange is skipped, sessions are issued with hard-coded `firmId: 'demo-firm'`

- File: `apps/api/src/modules/identity/identity.service.ts:35-78`
- Issue: `oidcCallback()` ignores `code`/`state` and returns a hardcoded session for `firmId: 'demo-firm'` with role `lead_auditor`. `webauthnRegisterFinish()` and `webauthnLoginFinish()` discard the attestation/assertion response (`_resp`) and only check that some prior challenge existed in an in-memory `Map`. There is no public-key verification, no signature counter check, no origin check, and no user-handle check. The supporting OIDC wiring (`apps/api/src/modules/identity/identity.controller.ts:33-44`) marks every endpoint `@Public()`, so an attacker can call `webauthn/register/finish` with arbitrary JSON and receive a session.
- Impact: Authentication is decorative. Any attacker can mint a `lead_auditor` session for `demo-firm` (and once Identity is fixed, any attacker who can call register/start/finish in sequence can mint a session as any chosen username). This compounds Blocker #1: even if Blocker #1 is fixed, Identity does not actually authenticate.
- Recommendation: Replace with the real implementation: `WebAuthnService` (`packages/auth-core/src/webauthn.ts:37-105`) for register/login finish (it already calls `verifyRegistrationResponse`/`verifyAuthenticationResponse` from `@simplewebauthn/server`); `OidcClient.completeAuthFlow()` (`packages/auth-core/src/oidc.ts:79-101`) for code exchange with PKCE state/nonce checks. Persist the WebAuthn signature counter and reject any login where `counter <= storedCounter`. Bind the issued session to a server-side store keyed on a secret cookie.
- Owner: `apps/api/src/modules/identity`

### BLOCKER #4 — `SignedActionInterceptor` does not actually verify WebAuthn attestations; any 16-character string passes

- File: `apps/api/src/common/signed-action.interceptor.ts:17-29`
- Issue: For any endpoint decorated with `@RequiresSignedAction()`, the interceptor only checks that `x-webauthn-attestation` is a string of length ≥ 16. The `// TODO(phase-1): verify attestation signature against challenge using @simplewebauthn/server` comment confirms this is intentional debt. As a result, signed-action endpoints (e.g., `/findings/:id/sign`, `/reports/sign`, `/peer-review/approve` per the RBAC suite at `tests/security/suites/rbac-matrix.test.ts:9-19`) accept any attacker-supplied 16-char string as a "signature." Combined with Blocker #1, an unauthenticated attacker can sign reports and freeze archives.
- Impact: Non-repudiation guarantees in the threat model (`docs/architecture/threat-model.md:50, 82`) are not enforced. The CAdES-LT/PAdES-LTV signing pipeline (`packages/report-engine/src/signing/*`) is robust, but the gating on which auditor is allowed to *invoke* the signer is broken.
- Recommendation: (a) Issue a per-action server challenge bound to (auditor, action, resource, request body hash, expiry) and store it in Redis. (b) Verify the WebAuthn assertion using `verifyAuthenticationResponse` against that challenge and the auditor's stored credential / counter. (c) Reject if counter does not strictly increase. (d) Emit a `signed_action.verified` ledger event with the authenticator AAGUID. (e) Add a security suite case under `tests/security/suites/` that POSTs a 32-character-but-bogus attestation and expects 401.
- Owner: `apps/api/src/common`

### BLOCKER #5 — RBAC matrix in `apps/api` is divergent and incomplete vs the canonical 9-role matrix in `packages/auth-core`

- File: `apps/api/src/adapters/auth-core.adapter.ts:5-75` (vs `packages/auth-core/src/rbac.ts:2-326`)
- Issue: The api-local adapter (used by the active `RbacGuard` at `apps/api/src/common/rbac.guard.ts:33-37`) defines a *different* role set (`auditor`, `observer`, `accreditation_inspector`, `service`) and uses **resource-string wildcards** — e.g., `firm_admin` gets `{ resource: '*', actions: ['read'] }` (line 24) and `service` gets `{ resource: '*', actions: ['read', 'create', 'update'] }` (line 61). The `can()` function (lines 64-73) iterates over every role, so a session with the `service` role auto-passes `read|create|update` on every resource regardless of scope. The 9-role/24-resource scope-aware matrix in `packages/auth-core/src/rbac.ts` (with `engagement`/`firm`/`own`/`global`/`none` scopes) is not consulted. The `// TODO(phase-1): replace with packages/auth-core when available` at the top of the adapter confirms this is the temporary stub. The RBAC test (`tests/security/suites/rbac-matrix.test.ts:8-19`) asserts only 10 endpoints across 9 roles with hand-coded allow-lists; it does not exercise either matrix nor scope semantics. There is no test that demonstrates the api guard rejects the `service` role for `evidence-vault.read` on a different firm.
- Impact: (1) Privilege escalation: any role with `*` can perform any non-listed action; the `service` role is one compromise away from full read/create/update of every resource. (2) Scope evasion: there is no `engagement` vs `firm` scope check at all — a `lead_auditor` whose engagement is `eng-1` can read evidence from `eng-2` in the same firm because the guard only checks *some* role allows the action. (3) Test coverage gap: 9 × 24 × 9 = 1944 cell matrix is unenforced.
- Recommendation: (a) Replace the adapter with `packages/auth-core/src/rbac.ts`'s `can()` and `canScope()` and pipe `engagement`/`firm` scope into the request-context so guards can enforce scope alongside permission. (b) Drop wildcard `'*'` from the matrix; enumerate every (role, resource, action) explicitly via `buildFullPermissionMatrix()` (line 316) and pin a JSON snapshot in tests so any change to the matrix shows up in code review. (c) Replace `tests/security/suites/rbac-matrix.test.ts` with a property-based test driven by the canonical matrix that hits a real test app with all 9 roles × every controller route. (d) Delete `apps/api/src/adapters/auth-core.adapter.ts` once migrated.
- Owner: `apps/api/src/adapters`, `apps/api/src/common`

### HIGH #1 — RFC 3161 TSA is a placeholder; tamper-detection on the audit ledger is only as strong as the ledger storage itself

- File: `packages/audit-engine/src/tsa.ts:16-29`
- Issue: `StubTsaProvider` is named `stub:phase12-todo`, sets `placeholder: true` on every token, and "verifies" by recomputing `sha256(providerId | issuedAt | digest)` — i.e., anyone with write access to the row can forge a valid token by storing a digest plus matching `(providerId, issuedAt)`. There is no asymmetric signature, no real RFC 3161 TSR/TST. The threat-model row "Audit log tampering ⇒ Append-only ledger + hash chain + TSA" (`docs/architecture/threat-model.md:61`) therefore relies only on the SHA-256 chain — which is broken whenever any historical event is mutated, but the *chain repair* is trivial because hashing is unkeyed: an attacker who can edit the database can rehash and re-stub-sign every downstream event.
- Impact: With DB write access, ledger history can be silently rewritten and all "TSA" tokens regenerated to match. This breaks the non-repudiation anchor used by archive/freezing and the CAdES-LT story.
- Recommendation: (a) Wire a real TSA client (e.g., FreeTSA, DigiCert) implementing `TsaProvider`. (b) Persist the TSR token bytes verbatim and store the TSA cert chain. (c) Verify by parsing the TST and comparing `messageImprint` against `sha256Hex(canonicalPayload | metadata)`. (d) Until that lands, prevent BLOCKER-level claims by not advertising tamper-evidence in user-visible documentation.
- Owner: `packages/audit-engine`

### HIGH #2 — Test signer is the only signing path the report-engine ships; production keys ("hardware-test") path is unimplemented

- File: `packages/report-engine/src/signing/signer.ts:1-74`
- Issue: The package only exposes `generateTestKey()` and `testSign()`/`testVerify()` (an in-process ECDSA P-256 software signer). The header comment promises "production keys live outside this package — the engine emits a request, the host signs with the hardware key, the engine verifies and embeds" but no real signer-host adapter exists in `apps/api/src/modules/reports/` or anywhere else. There is no certificate-chain verification path, no trust anchor, no CRL/OCSP fetching to populate `SignedManifest.ltv` (`packages/report-engine/src/signing/types.ts:99-110`).
- Impact: All signed reports in the repo are ECDSA-signed with software-only ephemeral keys whose certificate is `Buffer.from('TEST-CERT|label|publicKey')`. CAdES-LT/PAdES-LTV claims are aspirational. A relying accreditation auditor verifying a frozen archive sees a signature that is mathematically valid but anchored to nothing.
- Recommendation: (a) Implement a `Pkcs11Signer` and a `WebAuthnSigner` host implementation that proxies the SignatureRequest to a real hardware-backed key. (b) Add `verify.ts` per the comment on line 50 with full chain verification against a configured trust anchor. (c) Refuse to embed any signature whose `hardwareKey === 'software-test'` when `NODE_ENV === 'production'`.
- Owner: `packages/report-engine`

### HIGH #3 — Probe sandbox is in-process and provides no real isolation

- File: `apps/worker/src/sandbox/policy.ts:21-66` and `packages/probe-engine/src/sandbox.ts:117-167`
- Issue: `apps/worker` ships only `AllowlistSandboxPolicy` (a host-string check) plus `withWallclock()` (an `AbortController` race). `ProcessSandbox` in the probe-engine is an in-process `Promise.race` that `// DOES NOT provide isolation — production code MUST use the worker sandbox` (line 116). There are no namespace, seccomp, cgroup, or egress-proxy implementations in `apps/worker/src/sandbox/`. The `processors/` directory is empty (`apps/worker/src` lists only `config/`, `schemas/`, `sandbox/`). Memory observation in `ProcessSandbox.execute()` reports a `heapUsed` delta — a probe spinning a child process or allocating typed-array buffers will not be capped. `bandwidthBytesUsed` is hard-coded to 0 (line 162).
- Impact: A live probe (or anything posing as one) running in the same process as worker can: read the worker's secrets, make outbound network calls bypassing `AllowlistSandboxPolicy.isHostAllowed()` (because the policy is advisory — nothing forces traffic through it), exhaust memory beyond the cap, and exfiltrate data via the worker's own egress.
- Recommendation: (a) Spawn each probe in a separate process with `child_process.fork`/`spawn`, set `--max-old-space-size`, drop privileges, place in a Linux network namespace with an egress proxy that enforces `policy.egressAllowlist`. (b) Track outbound bytes via a counting transform in the proxy. (c) Add a `tests/security/suites/probe-sandbox-escape.test.ts` case that boots a sample probe attempting `http.get('http://169.254.169.254/...')` and asserts the egress proxy logs a denial. (d) Until the worker sandbox is real, refuse to run `mode: 'live'` probes.
- Owner: `apps/worker/src/sandbox`, `packages/probe-engine`

### HIGH #4 — `EvidenceRepository` keeps every uploaded evidence row in a process-local `Map`; restart equals data loss; tenant filter is in-memory only

- File: `apps/api/src/modules/evidence-vault/evidence-vault.repository.ts:9-46`
- Issue: The repository extends `BaseRepository` but never calls `withTenant()` or persists anything: `private readonly memory = new Map<string, EvidenceDto>();`. All filtering happens in JavaScript. `findById` returns `NotFoundError` on cross-firm access (good info-leak posture), but on process restart all evidence rows vanish. There is no SQL, so RLS — even if it existed — would not protect this code. Same pattern likely repeats across other modules (the repo extends `BaseRepository` but never uses it).
- Impact: Evidence is not persisted between deploys; cross-firm filtering depends on a single `if (r.firmId !== firmId)` line; the audit ledger emits `evidence.uploaded` for rows that will not survive restart. The signed-URL TTL (300 s in `signedDownload`) is fine in isolation but worthless once the row evaporates.
- Recommendation: Move all repositories to Drizzle queries with `withTenant()` wrappers, and gate the api on real RLS (Blocker #2). Add an integration test that uploads from firm A, restarts the api process, and confirms firm A still sees its evidence and firm B does not.
- Owner: `apps/api/src/modules/*`

### HIGH #5 — Helmet CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts in the web app

- File: `apps/web/next.config.ts:9-19`
- Issue: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` defeats the primary value of CSP against XSS. The threat model (`docs/architecture/threat-model.md:49`) lists "Strict CSP, Trusted Types" as the XSS mitigation; the shipped CSP is neither strict nor enables Trusted Types. `style-src 'unsafe-inline'` is more defensible but should still move to nonces or hashes long-term. `connect-src` only lists `localhost:4000` — production deployments will need a build-time substitution.
- Impact: Any reflected/stored XSS in any rendered field becomes RCE-in-browser; auditor session tokens and signed-action attestations are exfiltrable.
- Recommendation: (a) Move scripts to nonce-based CSP via Next.js middleware. (b) Add `require-trusted-types-for 'script'` and `trusted-types default`. (c) Make `connect-src` configurable via env. (d) Add a unit test that asserts the production CSP does not contain `unsafe-inline` or `unsafe-eval`.
- Owner: `apps/web`

### HIGH #6 — JWT helper hard-codes HS256 only; no algorithm pinning to the asymmetric `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` config slots

- File: `packages/auth-core/src/jwt.ts:48-58, 75-83` and `apps/api/src/config/config.schema.ts:33-34`
- Issue: `signSessionToken` always sets `alg: 'HS256'` and `verifySessionToken` accepts `algorithms: ['HS256']`. The api config exposes `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` slots but nothing reads them. Operating with HS256 in a multi-service deployment (api + worker + mcp-server all needing to verify) means the same shared secret must reach every component, and any compromise of one component leaks signing capability for all sessions. The `tests/security/suites/jwt-attacks.test.ts:1-29` "test" only checks two literal string functions, never round-trips a token through the actual helper.
- Impact: Lateral compromise: any service holding `SESSION_SECRET` can mint sessions for any other service. The mcp-server `JwksAuthGateway` (`apps/mcp-server/src/auth.ts:98-153`) expects asymmetric tokens (good), but `auth-core` cannot produce them.
- Recommendation: (a) Switch to RS256/EdDSA; load private key in api only, expose JWKs to other services. (b) Pin the verifier to the *expected* algorithm based on the key kind (reject HS-token-on-RS-key confusion). (c) Replace the JWT attack suite with tests that verify: alg=none rejected at the token layer, RS->HS confusion rejected, audience mismatch rejected, expired/nbf-future rejected, replay store hit returns 401, malformed header rejected. (d) Wire `InMemoryReplayStore` to Redis in production.
- Owner: `packages/auth-core`, `apps/api`

### HIGH #7 — Cloud-LLM package is empty; consent and PII-scrubber guards exist only in README

- File: `packages/llm-cloud/src/` (empty), `packages/llm-cloud/README.md:1-60`, `packages/co-auditor/src/backend-router.ts:18-33`
- Issue: The `LlmBackendRouter` (`backend-router.ts:18`) checks `consent.isActive(consentRecordId, engagementId)` before calling `cloud.generate(opts)`, but the `cloud` parameter has no implementation in tree. The README documents `CloudLlmAdapter`, `PiiScrubber`, `OutputClassifier`, and `ConsentStore` interfaces with imports like `import { createCloudLlm } from '@auditforge/llm-cloud'`, but `packages/llm-cloud/src/` contains no `.ts` files. Any production wiring of the router with a non-stub cloud backend depends on code that does not exist.
- Impact: The threat-model rows "PII leakage via prompt ⇒ PII scrubber + auditee consent record" and "We didn't authorise that call ⇒ Consent reference attached to every cloud-LLM ledger event" (`docs/architecture/threat-model.md:106-107`) are only enforced for the in-process router; the actual cloud egress, key handling, prompt caching, and the PII pre-call hook do not exist.
- Recommendation: Implement the package per the README — at minimum: `consent.ts` (`ConsentStore` with TTL/scope), `hooks.ts` (`PiiScrubber` chain), `anthropic.ts`/`openai.ts` (request-side redaction + `cache_control`), `cost.ts`. Block the api `co-auditor` module from selecting `backend: 'cloud'` until then (the controller currently accepts the value via DTO — confirm and gate).
- Owner: `packages/llm-cloud`

### HIGH #8 — `validateFilename()` rejects spaces but `safeFilename()` then accepts and rewrites them, and Unicode bidi/control chars (already in the test corpus) bypass detection

- File: `packages/evidence-vault/src/filename-safety.ts:3-36` and `tests/security/suites/file-upload-abuse.test.ts:7-18`
- Issue: `TRAVERSAL_PATTERNS` (line 3-10) includes `/ /` (any space) — meaning a perfectly legal filename like `"my report.pdf"` is rejected with reason `'path traversal pattern'`, while the bidi character `‮` (right-to-left override) in the test fixture is *not* itself in the regex list — it is rejected only because the test `'‮..\\evil'` happens to also contain `..`. A name like `‮gpd.exe` (RLO + `gpd.exe`, displayed as `‮exe.dpg`) passes `validateFilename()` and `safeFilename()` (which strips characters outside `[A-Za-z0-9._-]`, so the RLO is dropped — but the *original* name is what `EvidenceObject.filename` carries forward to UI rendering at `evidence-vault/src/upload-flow.ts:60`). MIME magic checks for ZIP-based docs only verify the first 4 bytes of `application/zip`, so polyglot files (e.g. PDF+ZIP) can wrap a malicious payload. The forbidden-name check at line 30 looks at `name.split('.')[0]` — `con.txt` is rejected, but `mycon.txt` is allowed and so is `con` with no extension at zero offset; on Windows `CON.` (with a trailing dot) and `LPT1 ` (trailing space) both bypass.
- Impact: Stored XSS via filename rendering in the UI (RLO/LRE), false positive UX (legitimate spaced names rejected), and Windows reserved-name corner cases remain.
- Recommendation: Drop the space rule; replace with a rule that strips/normalises Unicode classes (Cf, Cc, Co), NFKC-normalises before regex, rejects names whose normalised stem matches any reserved name (case-insensitive), and HTML-escapes filenames at every render site. Cap segment length post-normalisation at 200 *after* slicing the extension.
- Owner: `packages/evidence-vault`

### MEDIUM #1 — Idempotency cache is unbounded process-local memory

- File: `apps/api/src/common/idempotency.interceptor.ts:8-31`
- Issue: `private readonly cache = new Map<string, CacheEntry>();` with a 24-hour TTL but no eviction. An attacker who can call any POST while authenticated can grow the map by issuing a fresh `idempotency-key` each request. There is no LRU bound and no cleanup.
- Impact: DoS via memory bloat; replay scope is per-process (so behind a load balancer the same key reaches different processes and the second one re-executes the side effect — defeating the purpose).
- Recommendation: Move to Redis with a TTL and a tenant-scoped namespace; cap entry size. Add a property test that asserts the same `(firmId, url, key)` produces the same `body` across multiple processes.
- Owner: `apps/api/src/common`

### MEDIUM #2 — Throttler tracker collapses authenticated and anonymous traffic to `'anon:<ip>'`

- File: `apps/api/src/common/throttler.config.ts:7-14`
- Issue: When `req.auth` is missing (e.g., on `Public()` routes), the tracker key is `anon:<ip>`. Behind the `trustProxy: true` Fastify config (`apps/api/src/main.ts:22`), `req.ip` is whatever the upstream `X-Forwarded-For` header says. With no trust list configured, an attacker can rotate the `XFF` value per request to evade per-IP rate-limiting against `/identity/oidc/*` and `/identity/webauthn/*` (all `@Public`), enabling credential-/challenge-stuffing.
- Impact: Auth-endpoint brute-force and challenge-replay are effectively unrate-limited.
- Recommendation: Configure Fastify `trustProxy` with the explicit ingress CIDR(s), or use the socket remote address for anon throttling. Add a separate, stricter throttle bucket on identity routes.
- Owner: `apps/api/src/common`, `apps/api/src/main.ts`

### MEDIUM #3 — `IntegrityVerifier` keeps going after the first failed signature, but does not fail closed if `signatures` is empty

- File: `packages/archive/src/integrity.ts:24-37`
- Issue: The `signatures` and `tsaTokens` arrays are validated by `AuditFileArchive` (`packages/archive/src/domain.ts:32-33`) to have `min(1)`, but `IntegrityVerifier.verify()` does not re-assert this; if it is ever called with an `archive` constructed by a different code path that bypasses Zod, an empty `signatures` array yields `ok: true` because the loop never runs. Defensive depth would re-check.
- Impact: Low; relies on shape validation elsewhere being correct.
- Recommendation: Add `if (archive.signatures.length === 0) reasons.push('no signatures');` and the same for `tsaTokens`.
- Owner: `packages/archive`

### MEDIUM #4 — `LtvRenewalJob` renews based only on age, not on actual cert/CRL expiry of the embedded TSA cert

- File: `packages/archive/src/ltv-renewal.ts:14-27`
- Issue: Renews when `lastTsa.issuedAt` is older than `renewBeforeDays` (default 365). RFC 3161 best practice is to renew before the TSA's own *cert* or its anchor expires (often shorter than 365 days for low-assurance TSAs). Without parsing the cert NotAfter, an archive can pass the "we renewed last year" check while its underlying chain is already untrusted.
- Impact: LTV renewal can no-op for archives that are about to lose verifiability.
- Recommendation: Parse the leaf TSA cert NotAfter (and CRL nextUpdate) and renew when min(NotAfter, nextUpdate) < now + RENEW_WINDOW.
- Owner: `packages/archive`

### MEDIUM #5 — Probe RNG is `mulberry32` — the comment explicitly says non-cryptographic, but it is used to *select* test cases that may include sensitive cases

- File: `packages/probe-engine/src/rng.ts:3-44`
- Issue: Comment is correct: "NOT cryptographically secure. Probes use this only for sampling, NEVER for key generation." That is fine for reproducibility, but the seed is provided externally via `req.seed ?? 0` (`packages/probe-engine/src/runner.ts:82`). A predictable seed lets an auditee guess which cases the probe will sample, and prepare for them. For bias and robustness probes, this is a meaningful evasion path.
- Impact: Auditee can game adversarial probes.
- Recommendation: When `seed` is not provided, default to `crypto.randomInt()` and persist the seed in the ledger event so the audit is reproducible while not predictable in advance.
- Owner: `packages/probe-engine`

### MEDIUM #6 — `SignedUrlIssuer.issue()` does not enforce that grant input matches the storage key tenant prefix

- File: `packages/evidence-vault/src/signed-url.ts:16-27` and `filename-safety.ts:38-40`
- Issue: `issue(grant, storageKey, ttlSeconds)` accepts `storageKey` as a separate argument. There is no assertion that `storageKey.startsWith(tenantPrefix(grant.firmId, grant.engagementId, grant.evidenceId))`. The caller — currently `EvidenceService.signedDownload()` (`apps/api/src/modules/evidence-vault/evidence-vault.service.ts:39-43`) — does pass the row's `objectKey`, but a future caller mistake could issue a grant for one evidence id and a storage key from another tenant. The `EvidenceService` storage path also bypasses `SignedUrlIssuer` entirely and calls `storage.presignDownload` directly — so the per-grant `consume()` accounting (single-use, expiry) is not enforced for the api download path.
- Impact: Single-use enforcement and grant-revocation are not actually wired into the api download flow; cross-tenant grants are theoretically possible.
- Recommendation: (a) Make `SignedUrlIssuer` derive `storageKey` itself from the grant + a passed-in object-store interface, removing the extra argument. (b) Wire `EvidenceService.signedDownload` through `SignedUrlIssuer.issue` + `consume` so grants are persisted and audited. (c) Add a unit test that asserts a grant from firm A cannot be consumed against a key whose prefix is firm B.
- Owner: `packages/evidence-vault`, `apps/api/src/modules/evidence-vault`

### MEDIUM #7 — `OidcClient.fetchUserInfo` does not check `email_verified` before promoting a user

- File: `packages/auth-core/src/oidc.ts:119-130`
- Issue: `OidcUserInfo.emailVerified` is exposed to the caller, but no caller is wired up. The current `apps/api` `IdentityService` doesn't even use `OidcClient`. When it is wired up, a careless implementation that uses `userInfo.email` to look up an auditor (without checking `emailVerified === true`) lets a hostile IdP — or a self-signed IdP for a dev environment that an attacker tricks the deployment into trusting — assert any victim email.
- Impact: Federation account-takeover.
- Recommendation: When the real wiring lands, refuse to map email → auditor unless `emailVerified === true`. Also enforce `email_verified` claim check inside `fetchUserInfo` and log/reject if absent.
- Owner: `packages/auth-core`, future `apps/api/src/modules/identity`

### MEDIUM #8 — Audit-trail interceptor swallows ledger emit errors

- File: `apps/api/src/common/audit-trail.interceptor.ts:54-56`
- Issue: `void this.ledger.append(...).catch((err) => this.logger.error(...))` — if the ledger is down, the mutation succeeds but the audit row never lands. There is no fall-back queue, no DLQ, and no caller-visible error.
- Impact: Auditor-of-record action ("freeze archive", "sign report") can complete without a corresponding ledger event, breaking non-repudiation.
- Recommendation: For mutating high-risk actions, switch to the canonical pattern: write the ledger row in the same transaction as the business mutation and roll back if the append fails. For lower-risk actions, push to a durable queue (BullMQ) with retry and a DLQ.
- Owner: `apps/api/src/common`

### MEDIUM #9 — No release workflow with Sigstore/Cosign signing; supply-chain SBOM/provenance not produced

- File: `.github/workflows/` (only `ci.yml`, `security.yml`, `license-check.yml`)
- Issue: No `release.yml`. Container images and pnpm artifacts are not signed; no SBOM (CycloneDX or SPDX) is generated; no SLSA provenance attestation. Trivy scan in `security.yml` runs on filesystem only and the upload step is `if: always()` with `continue-on-error: true` on the scanner.
- Impact: Air-gapped pilot deployments (per `infra/helm/auditforge/values-airgapped.yaml`) cannot verify image authenticity. CVE-driven incident response lacks a per-build SBOM.
- Recommendation: Add `release.yml` that builds, generates SBOM (Syft), signs images and artifacts with Cosign, attests SLSA provenance, and pushes both to the registry. Make Trivy `--severity CRITICAL,HIGH` failing on findings (currently just uploads SARIF).
- Owner: `.github/workflows`

### INFO #1 — `drizzle.config.ts` references a non-existent schema barrel

- File: `packages/db/drizzle.config.ts:6` (`schema: './src/schema/index.ts'`); `packages/db/src/schema/` only has `_shared.ts`, `firms.ts`, `auditors.ts`
- Issue: Drizzle generation will fail. Mostly a build issue, but it tells us migrations have never been generated against the live schema.
- Recommendation: Land the missing tables and barrel before running `drizzle-kit generate`.
- Owner: `packages/db`

### INFO #2 — Probe-engine ships only 8 probes, not the 30-baseline target

- File: `packages/probe-engine/src/probes/` has `P-BIAS-01..04`, `P-ROB-01..03`, `P-INJ-01`
- Issue: Spec/CLAUDE description references "30 baseline AI probes." Only 8 exist. Coverage gap for the audit value proposition.
- Recommendation: Track in a follow-up issue. Document the gap in the README so production claims are consistent.
- Owner: `packages/probe-engine`

### INFO #3 — Co-auditor refusal regex misses common refusal phrases

- File: `packages/co-auditor/src/prompt-defense.ts:13-17`
- Issue: Patterns like "I'm sorry, but…", "I cannot provide…", "I am unable to…", "Sorry, I won't…" are not in the list.
- Recommendation: Expand the regex set; better yet, use a small classifier model invoked locally.
- Owner: `packages/co-auditor`

### INFO #4 — Security test directories `tests/security/{authn,crypto,injection,llm,owasp,upload}` are empty

- File: `tests/security/`
- Issue: Only `tests/security/suites/*` has test files. The directory layout suggests a richer organisation that has not been implemented; future contributors may not realise where to add new tests.
- Recommendation: Either delete the empty dirs or add `README.md` placeholders pointing to `suites/`.
- Owner: `tests/security`

### INFO #5 — Helm `values-airgapped.yaml` is sparsely commented for an airgap operator

- File: `infra/helm/auditforge/values-airgapped.yaml`
- Issue: Operators running airgapped will need explicit guidance on the Sealed-Secrets fallback, registry mirror, and Cosign-public-key trust anchor. Current values are mostly toggles.
- Recommendation: Add an `infra/helm/auditforge/AIRGAPPED.md` runbook.
- Owner: `infra/helm`

### INFO #6 — `apps/api/src/main.ts` Helmet CSP allows `'unsafe-inline'` for styles only; OK but document trade-off

- File: `apps/api/src/main.ts:28-41`
- Issue: API CSP is mostly tight (`scriptSrc: ["'self'"]`, `objectSrc: ["'none'"]`). Inline styles are a minor weakness only relevant to Swagger UI and the `/openapi.json` endpoint. Acceptable.
- Recommendation: Add a code comment explaining why; consider serving Swagger UI under a separate locked-down sub-path.
- Owner: `apps/api`

## Strengths Observed

- **Event-sourced ledger with canonical-JSON hashing.** `packages/audit-engine/src/hash.ts:6-34` and `ledger.ts:97-241` get the canonicalisation right: keys are recursively sorted, the chain hash is `sha256(prevHash | canonicalPayload | canonicalMetadata)`, sequence numbers are checked on insert and replay, and `verifyChain()` reports the first invalid sequence (`ledger.ts:181-227`). The Zod-typed event registry (`registry.ts:11-43`) prevents schema drift.
- **Dual-hash evidence model.** `packages/evidence-vault/src/hashing.ts:1-24` uses both SHA-256 and SHA3-256 — strong defence against single-algorithm collisions; the tamper test in `tests/security/suites/signature-tamper.test.ts` correctly exercises it.
- **Multi-signer + Merkle archive design.** `packages/archive/src/{merkle,freezer,integrity,ltv-renewal,accreditation}.ts` cleanly separate concerns; `bundleManifestRoot()` sorts entries before hashing, signatures and TSA tokens are decoupled, and `AccreditationPortalService` enforces a strict scope check (`accreditation.ts:26-33`).
- **Zod-validated config with strict secrets.** `apps/api/src/config/config.schema.ts` requires `SESSION_SECRET.min(32)` and refuses unknown env. `WorkerConfigSchema` mirrors the pattern. No production hardcoded credentials in source (only `infra/docker-compose.dev.yml` dev-only literals labelled `auditforge_dev_only`).
- **Helm chart hardening.** `infra/helm/auditforge/templates/networkpolicy.yaml:1-138` ships default-deny, namespaced ingress, and per-component egress baseline (api + worker). `serviceaccount.yaml` sets `automountServiceAccountToken: false`. ExternalSecrets template wires AWS Secrets Manager / SealedSecrets fallback (`externalsecret.yaml`).
- **CI security baseline.** `.github/workflows/security.yml` runs gitleaks (PR + nightly cron), Semgrep with SARIF upload, OSV-Scanner, and Trivy. `.github/workflows/license-check.yml` enforces SPDX headers and DCO sign-off. `.github/workflows/ci.yml` integration tests bring up real Postgres + Redis.
- **OIDC PKCE done right (in the package, even if unused by api).** `packages/auth-core/src/oidc.ts:57-101` issues a `randomState`, `randomNonce`, `randomPKCECodeVerifier`, S256 challenge — and the `completeAuthFlow` enforces `expectedState` and `expectedNonce` on the callback.
- **WebAuthn user-verification required.** `packages/auth-core/src/webauthn.ts:50-103` sets `userVerification: 'required'` for both registration and authentication, and uses `attestationType: 'none'` (correct privacy posture for a CB).
- **Prompt-injection corpus + fence escape test.** `packages/co-auditor/src/injection-payloads.ts` ships 30 categorised payloads; `tests/payloads` (plus the inline injection-payload test in `prompt-defense.test.ts:43-50`) asserts the fence terminator is escaped. The `validateOutputSchema` chain (`prompt-defense.ts:23-27`, `tasks.ts`) enforces structured output.
- **Probe budget pre-flight + record-spend pattern.** `packages/probe-engine/src/budget-controller.ts:78-130` correctly raises before incurring spend, separately tracks calls vs USD, and requires explicit approval over the warn threshold.
- **Pino redact list covers attestation header.** `apps/api/src/app.module.ts:58-61` redacts `req.headers["x-webauthn-attestation"]` alongside auth/cookie. Good leakage hygiene.

## STRIDE → Code Mapping (gaps highlighted)

| STRIDE row (threat-model.md) | Code/test artifact | Status |
|---|---|---|
| Web UI Phishing — WebAuthn mandatory | `packages/auth-core/src/webauthn.ts` exists; api `IdentityService` is a stub | **Gap** (Blocker #3) |
| Web UI XSS — strict CSP, Trusted Types | `apps/web/next.config.ts` allows `unsafe-inline`/`unsafe-eval`; no Trusted Types | **Gap** (High #5) |
| API Tier Tenant isolation — RLS + app guard | App guard partly present; **no RLS migrations** | **Gap** (Blocker #2) |
| API Tier Audit log tampering — append-only + hash chain + TSA | Chain present; **TSA is stub** | **Gap** (High #1) |
| API Tier Evidence enumeration — signed URLs + per-tenant prefix | `tenantPrefix()` correct in evidence-vault; api path bypasses `SignedUrlIssuer` | **Gap** (Medium #6) |
| API Tier SQL injection — Drizzle parameterised | All queries reviewed are template-tagged; no `sql.unsafe`/raw concat outside `tenancy-core` (parameterised) | OK |
| Worker Probe egress — egress allowlist + container netpolicy | `AllowlistSandboxPolicy` + Helm NetworkPolicy present; **no in-process enforcement** | **Gap** (High #3) |
| Worker Sandbox escape — restricted container | **No real container/seccomp/cgroup wiring** | **Gap** (High #3) |
| DB RLS bypass-role from API | API uses default Postgres user, not `app_request_role` | **Gap** (Blocker #2) |
| Object Store evidence overwrite — object lock + versioning | Not configured in Helm (`minio-statefulset.yaml`) | **Gap** (not enumerated separately) |
| Local LLM prompt injection — fence + output validators + auditor confirm | `prompt-defense.ts` present; `co-auditor` accepts before commit | OK |
| Cloud LLM PII leakage — scrubber + consent | Consent guard wired in router; **scrubber package empty** | **Gap** (High #7) |

## Suggested Fix Order

1. **Blocker #1 — Disable / gate `DevAuthMiddleware` on production.** Single-file change with a startup assertion. Ship before anything else; everything else assumes you cannot impersonate any user via headers.
2. **Blocker #5 — Wire `RbacGuard` to the canonical `packages/auth-core` matrix and remove `*` wildcards.** Smaller-impact than RLS and removes the privilege-escalation primitive.
3. **Blocker #3 + Blocker #4 — Real WebAuthn / OIDC verification in `IdentityService` and a real challenge-bound `SignedActionInterceptor`.** Both are tractable because the underlying primitives in `packages/auth-core` are correct.
4. **Blocker #2 — Land the RLS migrations and rotate the api connection to `app_request_role`.** Coordinate with the integration test suite and Testcontainers.
5. **High #4 — Replace in-memory repositories with Drizzle-backed ones.** Done after RLS so RLS protects them.
6. **High #6 — Move JWTs to RS256/EdDSA and centralise the JWKs.** Prereq for cross-service tokens (api ↔ worker ↔ mcp-server).
7. **High #1 + High #2 — Real RFC 3161 TSA + production CAdES/PAdES signer adapter.** Required before any externally-verifiable archive is emitted.
8. **High #3 — Real probe sandbox (process isolation + egress proxy + bandwidth metering).** Before enabling `mode: 'live'` for any auditee.
9. **High #5 — Tighten CSP, add Trusted Types.** Coupled with frontend nonce plumbing.
10. **High #7 — Implement `@auditforge/llm-cloud`** (consent store, PII scrubber, vendor adapters), or block the `cloud` backend at the api DTO layer until then.
11. **High #8 — Filename safety: drop space rule, add Unicode normalisation, escape on render.**
12. **Mediums #1–#9 — Idempotency in Redis, throttler IP source, integrity verifier defensive checks, LTV cert-aware renewal, RNG default-from-csprng, signed-url tenant-prefix assertion + integration into api, OIDC `email_verified` enforcement, audit-trail durable queue, release workflow with Cosign + SBOM.**
13. **Infos #1–#6.** Cleanups, docs, follow-ups.
