<!-- SPDX-License-Identifier: BUSL-1.1 -->

# API Reference

> Auto-generated from `apps/api/openapi/generated.json` by
> `scripts/build-api-reference.ts`.
> API version: 1.0.0

## By Tag

- [admin](./admin.md) — 2 endpoint(s)
- [agent-workflows](./agent-workflows.md) — 5 endpoint(s)
- [ai-systems](./ai-systems.md) — 5 endpoint(s)
- [archive](./archive.md) — 5 endpoint(s)
- [audit-dashboard](./audit-dashboard.md) — 1 endpoint(s)
- [audit-ledger](./audit-ledger.md) — 2 endpoint(s)
- [audit-plans](./audit-plans.md) — 5 endpoint(s)
- [billing](./billing.md) — 5 endpoint(s)
- [candidate-findings](./candidate-findings.md) — 3 endpoint(s)
- [capa](./capa.md) — 5 endpoint(s)
- [clients](./clients.md) — 5 endpoint(s)
- [co-auditor](./co-auditor.md) — 5 endpoint(s)
- [coverage](./coverage.md) — 1 endpoint(s)
- [cross-engagement-memory](./cross-engagement-memory.md) — 2 endpoint(s)
- [cross-framework](./cross-framework.md) — 5 endpoint(s)
- [engagements](./engagements.md) — 5 endpoint(s)
- [evidence-extraction](./evidence-extraction.md) — 1 endpoint(s)
- [evidence-vault](./evidence-vault.md) — 5 endpoint(s)
- [findings](./findings.md) — 5 endpoint(s)
- [health](./health.md) — 5 endpoint(s)
- [identity](./identity.md) — 7 endpoint(s)
- [interviews](./interviews.md) — 6 endpoint(s)
- [interviews-live](./interviews-live.md) — 4 endpoint(s)
- [library](./library.md) — 1 endpoint(s)
- [observability](./observability.md) — 3 endpoint(s)
- [peer-review](./peer-review.md) — 8 endpoint(s)
- [probes](./probes.md) — 7 endpoint(s)
- [qa-checklist](./qa-checklist.md) — 2 endpoint(s)
- [readiness](./readiness.md) — 1 endpoint(s)
- [reports](./reports.md) — 6 endpoint(s)
- [risks](./risks.md) — 5 endpoint(s)
- [samples](./samples.md) — 8 endpoint(s)
- [search](./search.md) — 3 endpoint(s)
- [soa](./soa.md) — 5 endpoint(s)
- [surveillance](./surveillance.md) — 6 endpoint(s)
- [tenancy](./tenancy.md) — 5 endpoint(s)
- [traces](./traces.md) — 6 endpoint(s)
- [working-papers](./working-papers.md) — 6 endpoint(s)
- [working-papers-sync](./working-papers-sync.md) — 1 endpoint(s)

## Alphabetic Index (all endpoints)

| Method | Path | Tag | Summary |
|---|---|---|---|
| `GET` | `/healthz` | [health](./health.md) |  |
| `GET` | `/healthz/deps` | [observability](./observability.md) |  |
| `GET` | `/healthz/live` | [health](./health.md) |  |
| `GET` | `/healthz/ready` | [health](./health.md) |  |
| `GET` | `/metrics` | [health](./health.md) |  |
| `GET` | `/readyz` | [health](./health.md) |  |
| `POST` | `/v1/admin/chain/verify-all` | [admin](./admin.md) |  |
| `POST` | `/v1/admin/impersonate` | [admin](./admin.md) | Time-boxed admin impersonation (audit logged) |
| `GET` | `/v1/agent-workflows` | [agent-workflows](./agent-workflows.md) | List agent-workflows |
| `POST` | `/v1/agent-workflows` | [agent-workflows](./agent-workflows.md) |  |
| `DELETE` | `/v1/agent-workflows/{id}` | [agent-workflows](./agent-workflows.md) |  |
| `GET` | `/v1/agent-workflows/{id}` | [agent-workflows](./agent-workflows.md) |  |
| `PATCH` | `/v1/agent-workflows/{id}` | [agent-workflows](./agent-workflows.md) |  |
| `GET` | `/v1/ai-systems` | [ai-systems](./ai-systems.md) | List ai-systems |
| `POST` | `/v1/ai-systems` | [ai-systems](./ai-systems.md) |  |
| `DELETE` | `/v1/ai-systems/{id}` | [ai-systems](./ai-systems.md) |  |
| `GET` | `/v1/ai-systems/{id}` | [ai-systems](./ai-systems.md) |  |
| `PATCH` | `/v1/ai-systems/{id}` | [ai-systems](./ai-systems.md) |  |
| `GET` | `/v1/archive` | [archive](./archive.md) | List archive |
| `POST` | `/v1/archive` | [archive](./archive.md) |  |
| `DELETE` | `/v1/archive/{id}` | [archive](./archive.md) |  |
| `GET` | `/v1/archive/{id}` | [archive](./archive.md) |  |
| `PATCH` | `/v1/archive/{id}` | [archive](./archive.md) |  |
| `GET` | `/v1/audit-ledger/events` | [audit-ledger](./audit-ledger.md) | Stream ledger events for the current firm |
| `GET` | `/v1/audit-ledger/verify` | [audit-ledger](./audit-ledger.md) | Verify the hash chain for the current firm |
| `GET` | `/v1/audit-plans` | [audit-plans](./audit-plans.md) | List audit-plans |
| `POST` | `/v1/audit-plans` | [audit-plans](./audit-plans.md) |  |
| `DELETE` | `/v1/audit-plans/{id}` | [audit-plans](./audit-plans.md) |  |
| `GET` | `/v1/audit-plans/{id}` | [audit-plans](./audit-plans.md) |  |
| `PATCH` | `/v1/audit-plans/{id}` | [audit-plans](./audit-plans.md) |  |
| `GET` | `/v1/billing` | [billing](./billing.md) | List billing |
| `POST` | `/v1/billing` | [billing](./billing.md) |  |
| `DELETE` | `/v1/billing/{id}` | [billing](./billing.md) |  |
| `GET` | `/v1/billing/{id}` | [billing](./billing.md) |  |
| `PATCH` | `/v1/billing/{id}` | [billing](./billing.md) |  |
| `GET` | `/v1/capa` | [capa](./capa.md) | List capa |
| `POST` | `/v1/capa` | [capa](./capa.md) |  |
| `DELETE` | `/v1/capa/{id}` | [capa](./capa.md) |  |
| `GET` | `/v1/capa/{id}` | [capa](./capa.md) |  |
| `PATCH` | `/v1/capa/{id}` | [capa](./capa.md) |  |
| `GET` | `/v1/clients` | [clients](./clients.md) | List clients |
| `POST` | `/v1/clients` | [clients](./clients.md) |  |
| `DELETE` | `/v1/clients/{id}` | [clients](./clients.md) |  |
| `GET` | `/v1/clients/{id}` | [clients](./clients.md) |  |
| `PATCH` | `/v1/clients/{id}` | [clients](./clients.md) |  |
| `GET` | `/v1/co-auditor` | [co-auditor](./co-auditor.md) | List co-auditor |
| `POST` | `/v1/co-auditor` | [co-auditor](./co-auditor.md) |  |
| `DELETE` | `/v1/co-auditor/{id}` | [co-auditor](./co-auditor.md) |  |
| `GET` | `/v1/co-auditor/{id}` | [co-auditor](./co-auditor.md) |  |
| `PATCH` | `/v1/co-auditor/{id}` | [co-auditor](./co-auditor.md) |  |
| `GET` | `/v1/cross-engagement-memory` | [cross-engagement-memory](./cross-engagement-memory.md) | Query anonymized per-firm cross-engagement patterns. Read-only; lead-auditor consumption surface. |
| `POST` | `/v1/cross-engagement-memory/aggregate/{engagementId}` | [cross-engagement-memory](./cross-engagement-memory.md) | Trigger pattern aggregation for a closed engagement. Anonymizer enforced; emits cross-engagement-memory.aggregated. |
| `GET` | `/v1/cross-framework` | [cross-framework](./cross-framework.md) | List cross-framework |
| `POST` | `/v1/cross-framework` | [cross-framework](./cross-framework.md) |  |
| `DELETE` | `/v1/cross-framework/{id}` | [cross-framework](./cross-framework.md) |  |
| `GET` | `/v1/cross-framework/{id}` | [cross-framework](./cross-framework.md) |  |
| `PATCH` | `/v1/cross-framework/{id}` | [cross-framework](./cross-framework.md) |  |
| `GET` | `/v1/engagements` | [engagements](./engagements.md) | List engagements (cursor paginated) |
| `POST` | `/v1/engagements` | [engagements](./engagements.md) |  |
| `GET` | `/v1/engagements/{engagementId}/candidate-findings` | [candidate-findings](./candidate-findings.md) | List candidate findings drafted by the conversational engine |
| `POST` | `/v1/engagements/{engagementId}/candidate-findings/{cfId}/dismiss` | [candidate-findings](./candidate-findings.md) | Dismiss a candidate finding with rationale |
| `POST` | `/v1/engagements/{engagementId}/candidate-findings/{cfId}/promote` | [candidate-findings](./candidate-findings.md) | Promote a candidate to a formal finding (auditor confirmation only) |
| `GET` | `/v1/engagements/{engagementId}/coverage` | [coverage](./coverage.md) | Compute clause-by-clause coverage for the engagement |
| `GET` | `/v1/engagements/{engagementId}/dashboard/audit` | [audit-dashboard](./audit-dashboard.md) | Audit Mode dashboard for the engagement |
| `GET` | `/v1/engagements/{engagementId}/dashboard/readiness` | [readiness](./readiness.md) | Readiness Mode dashboard for the engagement |
| `GET` | `/v1/engagements/{id}` | [engagements](./engagements.md) |  |
| `PATCH` | `/v1/engagements/{id}` | [engagements](./engagements.md) |  |
| `POST` | `/v1/engagements/{id}/transition` | [engagements](./engagements.md) | Transition engagement lifecycle state |
| `GET` | `/v1/evidence` | [evidence-vault](./evidence-vault.md) |  |
| `POST` | `/v1/evidence-extract` | [evidence-extraction](./evidence-extraction.md) | Run schema-constrained VLM extraction over an uploaded image (model card, datasheet, fairness report, incident log). |
| `GET` | `/v1/evidence/{id}` | [evidence-vault](./evidence-vault.md) |  |
| `POST` | `/v1/evidence/{id}/download-url` | [evidence-vault](./evidence-vault.md) |  |
| `POST` | `/v1/evidence/uploads/finalize` | [evidence-vault](./evidence-vault.md) |  |
| `POST` | `/v1/evidence/uploads/presign` | [evidence-vault](./evidence-vault.md) | Get a presigned URL for direct browser upload |
| `GET` | `/v1/findings` | [findings](./findings.md) |  |
| `POST` | `/v1/findings` | [findings](./findings.md) |  |
| `GET` | `/v1/findings/{id}` | [findings](./findings.md) |  |
| `PATCH` | `/v1/findings/{id}` | [findings](./findings.md) |  |
| `POST` | `/v1/findings/{id}/transition` | [findings](./findings.md) |  |
| `POST` | `/v1/identity/logout` | [identity](./identity.md) | Clear the session cookie (best-effort) |
| `POST` | `/v1/identity/oidc/callback` | [identity](./identity.md) |  |
| `POST` | `/v1/identity/oidc/start` | [identity](./identity.md) | Begin OIDC authorization |
| `POST` | `/v1/identity/webauthn/login/finish` | [identity](./identity.md) |  |
| `POST` | `/v1/identity/webauthn/login/start` | [identity](./identity.md) |  |
| `POST` | `/v1/identity/webauthn/register/finish` | [identity](./identity.md) |  |
| `POST` | `/v1/identity/webauthn/register/start` | [identity](./identity.md) |  |
| `GET` | `/v1/interviews` | [interviews](./interviews.md) | List interviews |
| `POST` | `/v1/interviews` | [interviews-live](./interviews-live.md) | Start a live interview session. |
| `DELETE` | `/v1/interviews/{id}` | [interviews](./interviews.md) |  |
| `GET` | `/v1/interviews/{id}` | [interviews](./interviews.md) |  |
| `PATCH` | `/v1/interviews/{id}` | [interviews](./interviews.md) |  |
| `GET` | `/v1/interviews/{id}/coverage-delta` | [interviews-live](./interviews-live.md) |  |
| `PATCH` | `/v1/interviews/{id}/end` | [interviews-live](./interviews-live.md) |  |
| `GET` | `/v1/interviews/{id}/transcript` | [interviews-live](./interviews-live.md) |  |
| `GET` | `/v1/interviews/library` | [interviews](./interviews.md) | List curated interview library entries (filterable). |
| `POST` | `/v1/interviews/plan` | [interviews](./interviews.md) | Compose a time-boxed interview plan from the library. |
| `GET` | `/v1/library` | [library](./library.md) | Search the question library + framework catalogues |
| `POST` | `/v1/observability/errors` | [observability](./observability.md) |  |
| `POST` | `/v1/observability/web-vitals` | [observability](./observability.md) |  |
| `GET` | `/v1/peer-review` | [peer-review](./peer-review.md) | List peer-review |
| `POST` | `/v1/peer-review` | [peer-review](./peer-review.md) |  |
| `DELETE` | `/v1/peer-review/{id}` | [peer-review](./peer-review.md) |  |
| `GET` | `/v1/peer-review/{id}` | [peer-review](./peer-review.md) |  |
| `PATCH` | `/v1/peer-review/{id}` | [peer-review](./peer-review.md) |  |
| `GET` | `/v1/peer-review/{id}/comments` | [peer-review](./peer-review.md) | List comments on a peer-review package |
| `POST` | `/v1/peer-review/{id}/comments` | [peer-review](./peer-review.md) |  |
| `POST` | `/v1/peer-review/{id}/comments/{commentId}/resolve` | [peer-review](./peer-review.md) |  |
| `GET` | `/v1/probes` | [probes](./probes.md) |  |
| `POST` | `/v1/probes` | [probes](./probes.md) |  |
| `GET` | `/v1/probes/{id}` | [probes](./probes.md) |  |
| `POST` | `/v1/probes/{id}/execute` | [probes](./probes.md) | Queue a probe execution |
| `GET` | `/v1/probes/budget/{engagementId}` | [probes](./probes.md) |  |
| `GET` | `/v1/probes/executions/{executionId}` | [probes](./probes.md) |  |
| `GET` | `/v1/probes/executions/list` | [probes](./probes.md) |  |
| `POST` | `/v1/qa-checklist/evaluate` | [qa-checklist](./qa-checklist.md) | Evaluate the QA checklist for a draft report; returns deterministic { passed, items }. |
| `POST` | `/v1/qa-checklist/override` | [qa-checklist](./qa-checklist.md) | Lead-auditor override for a single failed checklist item. Rationale is logged to the audit ledger. |
| `GET` | `/v1/reports` | [reports](./reports.md) |  |
| `POST` | `/v1/reports` | [reports](./reports.md) |  |
| `GET` | `/v1/reports/{id}` | [reports](./reports.md) |  |
| `PATCH` | `/v1/reports/{id}` | [reports](./reports.md) |  |
| `POST` | `/v1/reports/{id}/render` | [reports](./reports.md) | Queue PDF rendering |
| `POST` | `/v1/reports/{id}/sign` | [reports](./reports.md) | Sign and issue report (WebAuthn-attested) |
| `GET` | `/v1/risks` | [risks](./risks.md) | List risks |
| `POST` | `/v1/risks` | [risks](./risks.md) |  |
| `DELETE` | `/v1/risks/{id}` | [risks](./risks.md) |  |
| `GET` | `/v1/risks/{id}` | [risks](./risks.md) |  |
| `PATCH` | `/v1/risks/{id}` | [risks](./risks.md) |  |
| `GET` | `/v1/samples` | [samples](./samples.md) | List samples |
| `POST` | `/v1/samples` | [samples](./samples.md) |  |
| `DELETE` | `/v1/samples/{id}` | [samples](./samples.md) |  |
| `GET` | `/v1/samples/{id}` | [samples](./samples.md) |  |
| `PATCH` | `/v1/samples/{id}` | [samples](./samples.md) |  |
| `POST` | `/v1/samples/calculate-size` | [samples](./samples.md) | Compute textbook attribute / variable / MUS sample size. |
| `POST` | `/v1/samples/draw` | [samples](./samples.md) | Draw a deterministic sample from a population. |
| `POST` | `/v1/samples/override` | [samples](./samples.md) | Swap a sampled unit for cause; rationale is logged to the ledger. |
| `POST` | `/v1/search` | [search](./search.md) |  |
| `POST` | `/v1/search/keyword` | [search](./search.md) |  |
| `POST` | `/v1/search/semantic` | [search](./search.md) |  |
| `GET` | `/v1/soa` | [soa](./soa.md) | List soa |
| `POST` | `/v1/soa` | [soa](./soa.md) |  |
| `DELETE` | `/v1/soa/{id}` | [soa](./soa.md) |  |
| `GET` | `/v1/soa/{id}` | [soa](./soa.md) |  |
| `PATCH` | `/v1/soa/{id}` | [soa](./soa.md) |  |
| `GET` | `/v1/surveillance` | [surveillance](./surveillance.md) | List surveillance |
| `POST` | `/v1/surveillance` | [surveillance](./surveillance.md) |  |
| `DELETE` | `/v1/surveillance/{id}` | [surveillance](./surveillance.md) |  |
| `GET` | `/v1/surveillance/{id}` | [surveillance](./surveillance.md) |  |
| `PATCH` | `/v1/surveillance/{id}` | [surveillance](./surveillance.md) |  |
| `GET` | `/v1/surveillance/clients/{id}/timeline` | [surveillance](./surveillance.md) |  |
| `GET` | `/v1/sync/health` | [working-papers-sync](./working-papers-sync.md) |  |
| `GET` | `/v1/tenancy` | [tenancy](./tenancy.md) | List tenancy |
| `POST` | `/v1/tenancy` | [tenancy](./tenancy.md) |  |
| `DELETE` | `/v1/tenancy/{id}` | [tenancy](./tenancy.md) |  |
| `GET` | `/v1/tenancy/{id}` | [tenancy](./tenancy.md) |  |
| `PATCH` | `/v1/tenancy/{id}` | [tenancy](./tenancy.md) |  |
| `GET` | `/v1/traces` | [traces](./traces.md) | List traces |
| `POST` | `/v1/traces` | [traces](./traces.md) |  |
| `DELETE` | `/v1/traces/{id}` | [traces](./traces.md) |  |
| `GET` | `/v1/traces/{id}` | [traces](./traces.md) |  |
| `PATCH` | `/v1/traces/{id}` | [traces](./traces.md) |  |
| `POST` | `/v1/traces/ingest` | [traces](./traces.md) | Ingest a raw trace dump (OTel/Langfuse/Phoenix) |
| `GET` | `/v1/working-papers` | [working-papers](./working-papers.md) |  |
| `POST` | `/v1/working-papers` | [working-papers](./working-papers.md) |  |
| `GET` | `/v1/working-papers/{id}` | [working-papers](./working-papers.md) |  |
| `PATCH` | `/v1/working-papers/{id}` | [working-papers](./working-papers.md) |  |
| `POST` | `/v1/working-papers/{id}/finalize` | [working-papers](./working-papers.md) |  |
| `POST` | `/v1/working-papers/{id}/submit` | [working-papers](./working-papers.md) |  |
