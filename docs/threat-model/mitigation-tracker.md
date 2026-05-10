# AuditForge — Mitigation Tracker (Wave 3)

<!-- SPDX-License-Identifier: BUSL-1.1 -->

Threats from `stride-analysis.md` mapped to mitigations with status,
owner, and target phase. Status legend:

- **Implemented**: in production code; tests assert behaviour.
- **Planned**: scheduled for a known phase.
- **Accepted-risk**: documented residual risk; reviewed quarterly.

| ID | Threat | Mitigation | File / Reference | Status | Target |
|----|--------|------------|------------------|--------|--------|
| M-001 | XSS exfil of bearer token | httpOnly cookie session + strict CSP | ADR-0018, ADR-0027, `apps/web/src/middleware.ts` | Planned | Phase 11 |
| M-002 | Cross-firm engagement creation | RLS session vars; mass-assignment guard | ADR-0017, `packages/db/src/with-rls.ts` | Implemented | — |
| M-003 | Yjs cross-firm subscribe | Per-room RBAC on upgrade + per-message check | ADR-0023, `apps/api/src/modules/working-papers/ws.gateway.ts` | Implemented | — |
| M-004 | Probe target prompt-injection | Schema-constrained extraction; `garak`/`PyRIT` corpus | ADR-0024, `packages/probe-engine/src/runners/*` | Implemented | — |
| M-004a | Probe SSRF (DNS rebind) | Egress allow-list; RFC1918 reject | `packages/probe-engine/src/egress-guard.ts` | Implemented | — |
| M-005 | Compromised firm signing key | HSM/KMS migration; per-engagement key rotation | ADR-0020, ADR-0016 follow-ups | Planned | Phase 15 |
| M-006 | Auditee data leak to cloud LLM | Air-gap + cloud-consent guard at provider layer | ADR-0025, `packages/llm-provider/src/factory.ts`, `packages/llm-provider/src/guarded-invoke.ts` | Implemented | — |
| M-006a | Cloud provider retains prompt data | Consent line + redaction; air-gap default | `packages/consent-registry/src/*` | Implemented | — |
| M-007 | MCP token replay after revoke | Short-lived tokens + revocation list | `packages/mcp-tools/src/auth.ts` | Planned | Phase 15 |
| M-008 | Audit ledger truncation | Hash chain + per-PR chain verifier probe | ADR-0020, `packages/audit-engine/src/chain-verifier.ts` | Implemented | — |
| M-009 | Tampered PDF post-publish | Embedded signed JSON sibling; veraPDF gate | ADR-0022, `packages/report-engine/src/pdf/embed-signed.ts` | Implemented | — |
| M-010 | Forged confirmation token | Server-minted, single-use, scoped, 5-min TTL | `packages/auth-core/src/confirmation-token.ts` | Implemented | — |
| M-011 | Auth-endpoint brute force | Per-IP rate limit on `/v1/auth/*` | `apps/api/src/modules/auth/rate-limit.guard.ts` | Implemented | — |
| M-012 | Phishing of password fallback | WebAuthn primary; passkey-only signin | ADR-0018, `apps/web/src/app/(auth)/auth/signin/page.tsx` | Implemented | — |
| M-013 | Engagement metadata leak in logs | Allow-list redactor | `packages/observability/src/redactor.ts` | Implemented | — |
| M-014 | TSA outage blocks publish | Deferred-TSA worker; pending-token tolerance | ADR-0020, `apps/worker/src/consumers/tsa.ts` | Implemented | — |
| M-015 | Prompt injection → tool execution | No tool-execution from LLM responses; MCP confirmation flow | ADR-0016, `apps/mcp-server/src/handlers/*` | Implemented | — |
| M-016 | MCP tool poisoning (description swap) | SHA-256 fingerprint of `{name, description, schema}`; load-time check | ADR-0016, `packages/mcp-tools/src/fingerprint.ts` | Implemented | — |
| M-017 | Supply-chain compromise via npm dep | Pinned lockfile; OSV-Scanner + Trivy nightly; SBOM on release | `.github/workflows/security.yml`, `.github/workflows/nightly.yml` | Implemented | — |
| M-018 | Cloud bill amplification (LLM) | Tier-router budget caps; per-engagement quota | ADR-0024, `packages/llm-provider/src/router.ts` | Implemented | — |
| M-019 | Disputed audit decisions | Hash-chained ledger + Ed25519 + RFC 3161 TSA | ADR-0020 | Implemented | — |
| M-020 | Probe response triggers parser RCE | Zod schemas on every probe-response field; fuzzed in `tests/probe-validity` | `packages/probe-engine/src/parsers/*` | Implemented | — |
| M-021 | EoP via stale role cache | 30 s TTL + explicit invalidation on role change | `packages/auth-core/src/role-cache.ts` | Implemented | — |
| M-022 | Source-repo secret leak | gitleaks in CI + .gitignore policy | `.github/workflows/security.yml` | Implemented | — |
| M-023 | OSS supply-chain attack via build tooling | Verify install-time scripts via `pnpm config set ignore-scripts true`; allow-list per dep | `.npmrc` policy | Planned | Phase 11 |
| M-024 | Working-paper IndexedDB at-rest leak | Browser-managed encryption only — accepted residual | ADR-0023 | Accepted-risk | reviewed Q3-2026 |
| M-025 | CSP `unsafe-inline` interim | Per-request nonce middleware behind feature flag | ADR-0027, commit `d66f424` | Planned | Phase 11 |

## Quarterly Review Schedule

- **Q3-2026** (Jul–Sep): re-score DREAD; close M-001, M-005, M-007 if
  Phase 11 / 15 land on schedule.
- **Q4-2026**: external pen-test against staging; expected to surface
  new threats — they will be added here, not into a separate document.
- **Q1-2027**: pre-Pilot security audit; auditor signs the document.

## Ownership

Mitigation owners are tracked in the engagement-management dashboard
under "Security Backlog" and not duplicated here to avoid drift.
