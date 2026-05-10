# AuditForge — STRIDE Analysis (Wave 3)

<!-- SPDX-License-Identifier: BUSL-1.1 -->

STRIDE per data flow defined in `system-context.md`. Each flow lists
Spoofing / Tampering / Repudiation / Information Disclosure / Denial of
Service / Elevation of Privilege threats together with the
countermeasures already in place (with file:line references where the
mitigation lives) and the residual risk.

Status legend: **[I]** implemented, **[P]** planned, **[A]**
accepted-risk, documented in mitigation tracker.

---

## F1 — Auditor login (WebAuthn)

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | Phishing of password fallback | WebAuthn primary; passkey-only signin in `apps/web/src/app/(auth)/auth/signin/page.tsx`; bound to RP origin | I |
| T | Replay of authenticator response | Server-issued challenge w/ TTL in `packages/auth-core/src/webauthn/challenge.ts` (single-use, server-side store) | I |
| R | Disputed signin | Every signin emits a `auth.signin` ledger event from `apps/api/src/modules/auth/auth.service.ts` (signed via ADR-0020 chain) | I |
| I | Credential exfil via XSS | CSP interim relaxation (ADR-0027) is the residual exposure; httpOnly cookie session in Phase 11 closes it | A → P |
| D | Brute force / credential stuffing | Rate limit `/v1/auth/*` at 5 req/min/IP via `apps/api/src/modules/auth/rate-limit.guard.ts` | I |
| E | Privilege escalation via tampered JWT | Signed bearer + RLS (ADR-0017) on every read; even a forged token cannot read another firm's data | I |

**Residual risk**: an XSS in the auditor's browser leaks the bearer
token (interim, see ADR-0018, ADR-0027). Tracked in
`mitigation-tracker.md` row M-001 (Phase 11 close).

---

## F2 — Engagement create

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | API impersonation | Bearer token validated in `apps/api/src/modules/auth/auth.guard.ts`; principal carries `firm_id` | I |
| T | Cross-firm engagement creation | RLS on `engagements`; `firm_id` from session var in `packages/db/src/with-rls.ts` | I |
| R | Disputed who-created-this | Engagement insert produces `engagement.created` outbox event → ledger (ADR-0021 + ADR-0020) | I |
| I | Sensitive engagement metadata in logs | API logger redacts PII fields per allow-list in `packages/observability/src/redactor.ts` | I |
| D | Mass engagement creation | API rate-limit on `POST /v1/engagements` at 30/min/firm | I |
| E | EoP via mass-assignment of `firm_id` | Zod schema in `apps/api/src/modules/engagements/dto/create.dto.ts` strips `firm_id` from input; API derives it from the session | I |

**Residual risk**: an authenticated insider can create engagements they
should not own; mitigated by per-engagement role assignment and review
in the engagement-list UI. Tracked as M-002.

---

## F3 — Working paper edit (Yjs sync)

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | Forged WebSocket subscription | Auth check on upgrade in `apps/api/src/modules/working-papers/ws.gateway.ts`; per-message check on writes (ADR-0023) | I |
| T | Server-side Doc tampering | Yjs deltas are append-only in IndexedDB + DB; ledger event on every snapshot | I |
| R | Disputed who-changed-what | Each Doc commit produces a ledger event with diff summary | I |
| I | Working-paper leak via cross-firm subscription | `(token, workingPaperId) → role` cached for 30 s; cache key includes `firm_id` to prevent confusion | I |
| D | Yjs broadcast amplification (a single bad client floods rooms) | Per-room rate limit (100 ops/sec/peer); WebSocket frame size cap 64 KB | I |
| E | Privilege escalation via post-revoke writes | Per-message role check evicted on `RoleRevoked` event from `packages/auth-core` | I |

**Residual risk**: malicious dependency in the auditor's browser could
inject Yjs ops; offline IndexedDB binary is not encrypted at rest
(browser-managed). Tracked as M-003.

---

## F4 — Probe execution against AI under test

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | Probe target spoofing (DNS rebinding to internal host) | Egress allow-list per engagement in `packages/probe-engine/src/egress-guard.ts`; SSRF guard rejects RFC1918 / link-local | I |
| T | Probe target tampers with response | Probe responses are evidence — stored verbatim, hashed, ledgered; auditor reviews | I |
| R | Disputed probe execution | Every probe run logs a ledger event with prompt, response hash, model id of the target | I |
| I | Probe leaks engagement data into a third-party AI | Probes carry only synthetic prompts (verified by `garak`/`PyRIT` wrappers); no real evidence sent | I |
| D | Probe target crash / timeout amplification | Per-probe timeout 30 s, per-engagement budget 2000 probes/hour | I |
| E | Probe response triggers RCE in our parser | Probe responses are treated as untrusted text; only structured fields (zod-validated) are persisted | I |

**Residual risk**: a sophisticated probe target could embed a working
prompt-injection in its response that fools a downstream LLM call; the
tier router (ADR-0024) and schema-constrained extraction limit the
blast radius. Tracked as M-004.

---

## F5 — Report publish (signing, TSA, ledger)

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | Forged auditor identity on signing | Lead-auditor role check + WebAuthn re-auth + confirmation token | I |
| T | Tampered PDF after publish | PDF/A-3 signed via Ed25519 (ADR-0020); embedded JSON sibling re-hashable | I |
| R | Disputed publish action | Ledger event with TSA token (RFC 3161); chain re-verifiable | I |
| I | Pre-publish report leakage | Report draft visible only to lead-auditor + designated peer reviewer; RLS enforces | I |
| D | TSA outage blocks publish | Deferred-TSA worker writes the ledger row immediately; TSA token back-filled within 60 s; verifier tolerates pending | I |
| E | EoP via tampered confirmation token | Tokens are server-minted, single-use, bound to `(userId, reportId, action)` and expire in 5 min | I |

**Residual risk**: a compromised firm signing key invalidates all
reports signed by it; HSM/KMS migration in Phase 15 mitigates. Tracked
as M-005.

---

## F6 — LLM invocation (cloud + local)

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | Provider impersonation (e.g. attacker MITM on Anthropic endpoint) | TLS 1.3 + cert pinning per provider in `packages/llm-provider/src/transport.ts` | I |
| T | Tampered prompt at provider | Prompt is hashed pre-send; hash logged in `llm_invocations`; response is what we got, no integrity guarantee from the provider | I |
| R | Disputed model output | Every invocation logs provider, model name, model hash, prompt hash, response, tokens, latency, cost, accept/reject | I |
| I | Auditee data leaked to cloud | Air-gap + cloud-consent guard (ADR-0025); enforcement at provider factory + invocation hook | I |
| D | Provider rate-limit / quota outage | Tier router fallback (ADR-0024); local provider always available as fallback in non-air-gap | I |
| E | Prompt injection escalates to tool execution | Schema-constrained extraction (CLAUDE.md hard rule); free-form output is a bug; no tool-execution from LLM responses outside the MCP confirmation flow | I |

**Residual risk**: a cloud provider retains prompt data per their ToS;
mitigated by consent, redaction, and the air-gap default. Tracked as
M-006.

---

## F7 — MCP tool call (Phase 15)

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| S | Forged MCP client identity | OAuth2 client cert + per-client allow-list in `packages/mcp-tools/src/auth.ts` | P |
| T | Tool poisoning (description swap) | SHA-256 fingerprint of `{name, description, inputSchema}` checked at module load; bump requires server version bump (ADR-0016) | I |
| R | Disputed agent action | Every tool call emits a signed receipt to the ledger | I |
| I | Cross-tenant data via MCP | Principal scoped to one firm at token-issue time; engagement list pinned at session start | I |
| D | Tool flood | Per-client rate limit (100/min); per-tool budgets | P |
| E | EoP via mutating tool without confirmation | Only `report.publish` mutates; requires confirmation token + Ed25519-signed receipt (ADR-0016) | I |

**Residual risk**: an MCP client compromised after token issue can
replay read tools at full rate until the token expires; rotation is the
mitigation. Tracked as M-007.

---

## Cross-cutting Threats

| STRIDE | Threat | Countermeasure | Status |
|--------|--------|----------------|--------|
| I | Source-repo secret leak | gitleaks in CI (`.github/workflows/security.yml`); `.gitignore` policy | I |
| T | Supply-chain compromise via dep | OSV-Scanner + Trivy in `nightly.yml`; pinned lockfile; SBOM on release | I |
| R | Audit ledger truncation | Chain verifier walks every row; tamper evidence on truncation | I |
| D | Cloud bill amplification (LLM) | Budget caps in tier router; per-engagement quota | I |
| E | EoP via stale role cache | Role cache 30 s TTL; explicit invalidation on role change | I |

---

## Notes for Reviewers

- File:line references are intentionally pointing to *paths*, not commit
  hashes, so the document survives refactor; check the latest ref via
  `git log --follow` on a citation if anything looks off.
- New threats discovered during implementation must be added here
  *before* the affected PR merges; per-phase security review gate
  enforces this.
