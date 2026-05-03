# Threat Model v1 — STRIDE

This is the Phase 0 threat model. It is reviewed and extended every phase. Changes go through a security-tagged PR.

## System Boundary

In scope:
- Web UI (Next.js, served from `apps/web`)
- Desktop client (Tauri shell wrapping the web UI)
- Mobile PWA
- API tier (NestJS modular monolith, `apps/api`)
- Worker tier (BullMQ, `apps/worker`) — probe runner, trace ingest, AV, OCR, report render
- Postgres 16 + Redis 7 + MinIO/S3 + Meilisearch + Ollama
- Audit ledger storage and signing infrastructure
- Connectors: MLflow, W&B, Hugging Face, OTel/Langfuse, Generic OpenAPI, MCP

Out of scope (treated as untrusted):
- Auditee inference endpoints (called by probes)
- Cloud LLM providers (used only with consent)
- Browser extensions on the auditor workstation

## Assets

| Asset | Sensitivity |
|-------|-------------|
| Audit working papers, findings, NCs | Confidential — auditee/auditor privilege |
| Evidence files (logs, screenshots, model cards) | Confidential |
| Cryptographic signing keys (passkeys, PKCS#11) | Critical — held in hardware |
| Audit ledger events | Tamper-sensitive (integrity > confidentiality) |
| Tenant credentials (auditor + client portal) | Confidential |
| ISO 42001 clause + Annex A reference catalogue | Public reference data |
| Probe definitions + premium probe code | Confidential |

## Trust Zones

1. **Public internet** — anyone.
2. **Authenticated auditor** — carries firm + auditor identity.
3. **Authenticated auditee user** — carries client identity, scoped to their engagement.
4. **Accreditation auditor (read-only)** — scoped to specific archived files.
5. **Service accounts** — worker, migration, archive renewal.

## STRIDE Per Component

### Web UI (Public Internet → Authenticated)

| Threat | Mitigation |
|--------|-----------|
| **S** Phishing of auditor credentials | WebAuthn / passkeys mandatory; OIDC + MFA; CSP; SRI for assets. |
| **T** XSS / DOM tampering | Strict CSP, Trusted Types, no dangerouslySetInnerHTML, Content-Type sniffing off. |
| **R** Auditor denies an action | Audit ledger + WebAuthn-signed events at high-risk operations. |
| **I** Session hijack | SameSite=Lax cookies, short-lived JWTs, rotation, IP/UA binding (advisory). |
| **D** UI flooding | Edge rate-limit + WAF. |
| **E** Auditor → super-admin | Server-side RBAC; UI permission checks are advisory only. |

### API Tier

| Threat | Mitigation |
|--------|-----------|
| **S** API key replay | Short-lived tokens, JWK rotation, per-request nonce on signed-action endpoints. |
| **T** Tenant isolation bypass | Postgres RLS + app-layer guard (ADR-0003). |
| **R** Audit log tampering | Append-only ledger + hash chain + TSA (ADR-0002). |
| **I** Evidence enumeration | Signed URLs with short TTL, per-tenant prefix, at-rest envelope encryption. |
| **D** Resource exhaustion | Per-tenant quotas, request-cost accounting, BullMQ rate limits. |
| **E** SQL injection | Drizzle parameterised queries; CI Semgrep rules; no raw SQL outside reviewed migrations. |

### Worker / Probe Runner

| Threat | Mitigation |
|--------|-----------|
| **S** Forged probe job | Jobs signed with worker key; replay-protected. |
| **T** Probe modifies audit state directly | Workers write only via the ledger API; CI lint forbids cross-imports. |
| **R** "I never ran that probe" | Every execution is a ledger event. |
| **I** Probe exfiltrates data via egress | Egress allowlist per execution (ADR-0007); container-level network policy. |
| **D** Cost runaway via live probes | Per-engagement budget; explicit confirm > threshold; rate limits. |
| **E** Sandbox escape | Worker runs in restricted container (no host mount, dropped caps, seccomp). External pen test. |

### Database (Postgres + RLS)

| Threat | Mitigation |
|--------|-----------|
| **T** Bypass-RLS role reachable from API | API uses RLS-enforced role only; bypass role limited to migrations + worker maintenance. |
| **I** Backup theft | At-rest encryption (LUKS / RDS encryption); per-tenant envelope encryption for sensitive columns. |
| **R** DBA edits silently | All audit-relevant tables have INSERT/UPDATE triggers logging to ledger. |
| **D** Connection exhaustion | PgBouncer; per-tenant pool limits. |

### Object Store (MinIO / S3)

| Threat | Mitigation |
|--------|-----------|
| **I** Direct evidence access | Signed URLs only; bucket policy denies anonymous; per-tenant prefix. |
| **T** Evidence overwrite | Object lock + versioning on the evidence bucket. |
| **D** Unbounded upload | Per-engagement quota; size limit; AV scan before linkage. |

### Local LLM (Ollama)

| Threat | Mitigation |
|--------|-----------|
| **T** Prompt injection from auditee data | Prompt template hardening, output validators, "auditor confirms" gate (ADR-0005). |
| **I** Model files tampered | Hash verification at install; release signing. |
| **D** Model OOM | Per-call memory cap; queue depth limit. |

### Cloud LLM (Opt-In)

| Threat | Mitigation |
|--------|-----------|
| **I** PII leakage via prompt | PII scrubber (commercial tier) + auditee consent record. |
| **R** "We didn't authorise that call" | Consent reference attached to every cloud-LLM ledger event. |

## Top Residual Risks (Carry to Phase 1+)

1. Probe sandbox escape — needs container-level enforcement + external pen test (Phase 14).
2. Long-term signature renewal failure — runbook + drill (Phase 12, Phase 14).
3. CRDT merge data loss under pathological concurrency — production-grade Yjs + reconcile UI (Phase 4).
4. Cross-tenant leakage via cached search index — per-tenant search namespace + integration tests (Phase 4).
5. Audit ledger replay regression after schema migration — golden-file replay tests at every release (Phase 0+).

## Review Cadence

- Per phase: delta review tagged in PR.
- Per release: full review + external pen test from Phase 14 onwards.
