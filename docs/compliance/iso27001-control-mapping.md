<!--
SPDX-License-Identifier: BUSL-1.1
-->

# ISO 27001 Control Mapping

> Subset of ISO/IEC 27001:2022 Annex A controls relevant to AuditForge
> as a product processing sensitive audit data.

---

## Scope

This mapping covers ISO 27001:2022 controls applicable to AuditForge
as a SaaS/on-prem product. It is not a full ISMS mapping (operators
must maintain their own ISMS). It addresses product-level security
controls.

---

## Control Mapping

| ISO 27001 Control | Name | AuditForge implementation | Evidence | Status |
|---|---|---|---|---|
| A.5.1 | Policies for information security | CLAUDE.md; SECURITY.md; LICENSE | `CLAUDE.md`, `SECURITY.md` | implemented |
| A.5.15 | Access control | Postgres RLS + application RBAC; WebAuthn passkeys | `packages/auth-core/`, `docs/adr/0003-postgres-rls-tenancy.md` | implemented |
| A.5.17 | Authentication information | WebAuthn (no passwords); hardware key support | `apps/api/src/modules/identity/` | implemented |
| A.5.22 | Monitoring, review and change management of supplier services | Cloud LLM consent guard; DPA template; LLM invocation log | `packages/llm-provider/src/cloud-consent.guard.ts`, `docs/compliance/data-flows-and-dpa.md` | implemented |
| A.5.29 | Information security during disruption | Drizzle migrations (additive); WAL backup; zero-downtime upgrade procedure | `docs/operator-guide/10-upgrades.md`, `docs/operator-guide/06-backup-and-restore.md` | implemented |
| A.5.33 | Protection of records | Append-only ledger; TSA anchoring; WORM evidence storage | `packages/audit-engine/src/`, `docs/concepts/audit-ledger.md` | implemented |
| A.6.3 | Information security awareness, education and training | Developer onboarding docs; coding style guide; CLAUDE.md | `docs/developer-guide/` | implemented |
| A.8.2 | Privileged access rights | Admin impersonation is time-boxed and ledger-anchored | `apps/api/src/modules/admin/` | implemented |
| A.8.3 | Information access restriction | RLS per-tenant; per-engagement RBAC; candidate findings never exposed to auditee role | `packages/auth-core/`, Postgres RLS policies | implemented |
| A.8.5 | Secure authentication | WebAuthn FIDO2; SameSite=Strict; HttpOnly session cookies | `apps/api/src/modules/identity/` | implemented |
| A.8.7 | Protection against malware | Evidence files virus-scanned by `audit-evidence-runner` before extraction | `services/audit-evidence-runner/` | implemented |
| A.8.9 | Management of technical vulnerabilities | `pnpm audit` SCA in CI; Semgrep SAST; Gitleaks secrets scan | `semgrep/`, CI pipeline | implemented |
| A.8.12 | Data leakage prevention | Air-gap mode; cloud LLM consent guard; RLS prevents cross-tenant access | `packages/llm-provider/src/cloud-consent.guard.ts` | implemented |
| A.8.15 | Logging | Pino structured logs; OTEL traces; audit ledger | `packages/observability/`, `packages/audit-engine/` | implemented |
| A.8.16 | Monitoring activities | Prometheus + Grafana; SLO burn-rate alerts | `infra/observability/`, `infra/grafana/` | implemented |
| A.8.17 | Clock synchronization | NTP enforced at Kubernetes node level (operator responsibility); TSA tokens provide external time anchor | Operator deployment requirement | partial |
| A.8.20 | Networks security | Kubernetes NetworkPolicy; TLS 1.3 at ingress; WebSocket over TLS | `infra/helm/` values | implemented |
| A.8.24 | Use of cryptography | Ed25519 + SHA-256; JCS; RFC 3161 TSA; TLS 1.3 | `packages/signing/`, `docs/adr/0020-hash-chained-ledger-ed25519-tsa.md` | implemented |
| A.8.26 | Application security requirements | WCAG 2.2 AA; CSP nonces; SAST in CI | `docs/adr/0027-csp-relaxation-netlify-interim.md`, `semgrep/` | implemented |
| A.8.28 | Secure coding | CLAUDE.md hard rules; Semgrep custom rules; TypeScript strict mode | `CLAUDE.md`, `semgrep/`, `tsconfig.base.json` | implemented |
| A.8.29 | Security testing in development and acceptance | Semgrep; Playwright e2e; k6 load; ZAP (planned) | `tests/`, `semgrep/` | partial |
| A.8.34 | Protection of information systems during audit testing | Probe runner sandboxed in separate process; no write access to production DB from probe runner | `services/probe-runner-py/` | implemented |
