<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge ISO 42001 — Architecture Review

- **Date**: 2026-05-03
- **Reviewer**: Architecture (read-only review)
- **Branch / Commit**: `main` (working tree)
- **Scope**: Monorepo-wide. Boundary integrity, modular monolith discipline, event sourcing, tenancy, CRDT, LLM provider abstraction, bi-temporal claim graph, drafts-only engine, mode separation, cross-framework, deployment, operability, scalability, reversibility.
- **Source-of-truth references**: ADRs 0001–0013 (`docs/adr/`), `CLAUDE.md`, `v3.md`.

## Severity legend

| Severity | Meaning |
|---|---|
| **Critical** | Architectural invariant or ADR is contradicted by code. Ship-blocker. Defensibility / compliance impact. |
| **High** | Material gap between design intent and implementation; concrete risk of regression, cross-tenant leak, or replay-incompatible state. |
| **Medium** | Drift, duplication, or missing enforcement that will compound; should be addressed within the current phase. |
| **Low** | Hygiene / follow-through items. |
| **Info** | Observation / suggestion, not a violation. |

A short `Architectural Impact` rating (High/Medium/Low) is given per finding, expressing how much this finding constrains or distorts future architectural change.

---

## Executive summary

AuditForge has a strong **paper architecture**. Every major load-bearing pattern is documented as an ADR (modular monolith, event-sourced ledger, RLS tenancy, CRDT working papers, local-LLM default, signed audit file, sandboxed probe runner, cross-framework graph, bi-temporal claim graph, schema-constrained extraction, LLM provider abstraction, drafts-only engine, mode separation). The ADRs are consistent with each other and with `CLAUDE.md` / `v3.md`. The packages directory is correctly carved (25+ packages, each with its own README, `src/`, `tests/`, `package.json`, BUSL-1.1 SPDX header).

The **realised architecture** is much thinner than the paper. The most consequential gaps:

1. **The NestJS API does not consume the workspace packages.** Every API module reaches for a `phase-1 stub` adapter (`apps/api/src/adapters/audit-engine.adapter.ts`, `tenancy.adapter.ts`) and an in-memory `Map`-backed repository. No file under `apps/api/src` imports `@auditforge/audit-engine`, `@auditforge/tenancy-core`, `@auditforge/working-papers`, `@auditforge/probe-engine`, `@auditforge/audit-memory`, `@auditforge/co-auditor`, `@auditforge/llm-provider`, `@auditforge/conversational-engine`, `@auditforge/nc-drafter`, or `@auditforge/cross-framework`. The packages exist; the application is not wired through them. This is the root cause of most Critical / High findings in this report.
2. **Postgres RLS is a session-variable pattern in code, but the database has no policies.** `infra/postgres-init/01-extensions.sql` only loads extensions; no `CREATE POLICY`, no `ENABLE ROW LEVEL SECURITY`, no `set_tenant_context` function (despite `packages/tenancy-core` calling `SELECT set_tenant_context(...)`), and no migrations folder under `packages/db/drizzle/`. ADR-0003 is currently architectural intent only.
3. **v3 LLM provider abstraction package is empty.** `packages/llm-provider/{db,providers,routing,templates}` are zero-byte directories. `packages/llm-cloud` is the same. ADR-0010, ADR-0011 cannot hold without it.
4. **Mode separation is not encoded in the engagement domain.** ADR-0013 mandates `Audit Mode | Readiness Mode` at engagement creation; neither `apps/api/src/modules/engagements/dto.ts` nor `packages/engagement/src/types/engagement.ts` carry a `mode` field.
5. **Worker tier is essentially absent.** `apps/worker/src` has only `config/`, `sandbox/policy.ts`, `schemas/jobs.ts`. No `main.ts`, no BullMQ processors, no probe runner. Helm and `package.json` reference an entrypoint that does not exist.

Each of these is recoverable; none requires re-architecting. The priority is to wire the API to the packages, materialise the migrations + RLS, and complete the LLM provider package, in that order.

---

## Findings — by severity

### CRITICAL

#### C1. API and worker bypass the workspace packages; modules use stub adapters and in-memory `Map`s

- **Dimension**: 1 (Boundary integrity), 2 (Modular monolith discipline), 3 (Event sourcing correctness)
- **ADRs**: 0001, 0002
- **Architectural impact**: High
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/adapters/audit-engine.adapter.ts` (`TODO(phase-1): replace with packages/audit-engine when available`)
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/adapters/tenancy.adapter.ts` (`TODO(phase-1): replace with packages/tenancy-core when available`)
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/engagements/engagements.repository.ts` (uses `private readonly memory = new Map<string, EngagementDto>()`)
  - 24 repositories across `apps/api/src/modules/*/!(*.spec).repository.ts` extend `BaseRepository` but every one of them transacts against an in-process `Map`, not Postgres.
  - `apps/api/src/modules/audit-ledger/audit-ledger.service.ts:10` — `// TODO(phase-1): query packages/audit-engine.list when available.` returns empty list.
  - `apps/api/package.json` declares `@auditforge/audit-engine`, `@auditforge/tenancy-core`, `@auditforge/auth-core`, `@auditforge/db`, `@auditforge/catalogues`, `@auditforge/shared` as workspace dependencies. A repo-wide grep for `from '@auditforge/` under `apps/api/src/` returns **zero matches**.
- **Why it matters**: ADR-0001 §"Decision" demands "Cross-module communication is via a typed in-process bus, never via the HTTP layer" and treats `apps/api/src/modules/<name>` as code that consumes the workspace packages. Today every module is a self-contained CRUD wrapper. The hash-chained ledger in `packages/audit-engine` (which has a working `AuditLedger.emit/verifyChain/replay` pipeline with TSA stub) is unused by the running API; instead `AuditTrailInterceptor` calls a duplicate, in-memory `AuditEngineAdapter` that maintains chain tip in a `Map<string, ...>` keyed by tenant. Any production deploy of the API today produces a ledger that lives only in process memory and dies at restart. This contradicts ADR-0002 ("immutable events into `audit_ledger_events`").
- **Compounding risks**:
  - Replay (ADR-0002) is impossible because there is no `audit_ledger_events` table.
  - Cross-module communication via "typed in-process bus" (ADR-0001) is undocumented and unimplemented — modules wire each other only through Nest DI on adapters, never through events.
  - Worker app has the same shape: `apps/worker/src` contains `config/`, `sandbox/policy.ts`, `schemas/jobs.ts`. No `main.ts`, no `BullMQ Worker`, no processors. `package.json` references `node dist/main.js`.
- **Recommendation**:
  1. Phase-1.0 spike: replace `apps/api/src/adapters/audit-engine.adapter.ts` with a thin Nest provider that constructs `AuditLedger` from `@auditforge/audit-engine` and a Postgres-backed `EventRepository`. Remove the in-memory `chainTipByTenant`.
  2. Replace `apps/api/src/adapters/tenancy.adapter.ts` with `packages/tenancy-core/withTenantContext`. The application must stop maintaining its own local `SET LOCAL` SQL and use the package helper inside a real `TransactionExecutor`.
  3. Migrate at least one module end-to-end (recommend `engagements`) onto a Drizzle-backed repository and use it as the template; gate further phase work on parity with that module.
  4. Add an ESLint rule (`eslint-plugin-boundaries`, ADR-0001 follow-up) that forbids any module under `apps/api/src/modules/` from importing any sibling module's internal files (only its module barrel).

#### C2. Postgres RLS policies do not exist; DB-side defense-in-depth is absent

- **Dimension**: 4 (Tenancy)
- **ADR**: 0003
- **Architectural impact**: High
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/infra/postgres-init/01-extensions.sql` — only `CREATE EXTENSION` calls. No `CREATE POLICY`, no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, no `set_tenant_context()` function.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/db/src/schema/` — only `firms.ts` and `auditors.ts`; no migration outputs in `packages/db/drizzle/` (directory is empty).
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/tenancy-core/src/context.ts:21` calls `SELECT set_tenant_context($1::uuid, $2::uuid)` — a function that has not been created in any migration.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/db/base.repository.ts:22-26` issues `SET LOCAL app.current_firm_id`, but RLS policies that enforce filtering on this var do not exist.
  - `c:/Users/ekess/Downloads/iso42001auditforge/tests/security/suites/tenant-isolation.test.ts` — the "RLS test" is a hand-rolled in-memory `DB.filter()`. It does not exercise RLS at all. ADR-0003 follow-up (Test suite of RLS bypass attempts) is unfulfilled.
  - Repo-wide grep for `CREATE POLICY|ENABLE ROW LEVEL SECURITY` returns zero.
- **Why it matters**: ADR-0003's whole rationale is "a single bug in the application layer that omits a tenant filter on a query is enough to leak audit evidence across tenants." Today the application **only has an application layer** (and even that is `Map`-based — see C1). Once a real DB lands, every table created without a paired policy is a leak surface. There is no CI lint that "every new migration that creates a table must include a policy" (ADR-0003 follow-up).
- **Recommendation**:
  1. Add a base migration (`packages/db/drizzle/000_rls_bootstrap.sql`) that:
     - Creates `app.current_firm_id`, `app.current_auditor_id`, `app.current_engagement_id` GUC names with empty defaults.
     - Defines `set_tenant_context(uuid, uuid)` and `clear_tenant_context()` SQL functions matching `packages/tenancy-core/context.ts`.
     - Creates `service_account` and `read_only_accreditation` roles per ADR-0003.
  2. Make every `pgTable` schema in `packages/audit-memory/src/db/schema.ts` and any future schema produce a policy attached to `firm_id` (and `engagement_id` where relevant). Codify with a Drizzle schema lint or a pre-migration script.
  3. Replace `tests/security/suites/tenant-isolation.test.ts` with a Testcontainers test that boots Postgres, runs migrations, sets a session, and asserts cross-firm SELECT returns zero rows. Treat the existing file as a stub and rename it to `…-stub.test.ts` to make the gap explicit.
  4. Add a CI rule: any new migration touching `pgTable(...)` must contain `ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY` line referencing `current_firm_id`.

#### C3. `packages/llm-provider` and `packages/llm-cloud` are empty; v3 cannot run

- **Dimension**: 6 (LLM provider abstraction), 8 (Engine outputs as drafts)
- **ADRs**: 0005, 0010, 0011
- **Architectural impact**: High
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/llm-provider/src/{db,providers,routing,templates}` — all four directories exist and are zero-byte.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/llm-cloud/src` — empty.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/llm-local/src` — present (`ollama.ts`, `vllm.ts`, `factory.ts`, `http.ts`, `types.ts`).
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/co-auditor/src/backend-router.ts` — implements an ad-hoc `LlmBackendRouter` that takes a `local` and `cloud` `LlmBackend` and a `ConsentLookup`. This is the simpler v2 pattern; ADR-0011's tier router (`small/medium/large/reasoning`) is not yet present.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/audit-memory/src/db/schema.ts` references `model_invocation_id` UUID columns on `claims`, `claim_attributions`, `extraction_invocations`, `retrieval_invocations`. There is no `llm_invocations` table to point those FKs at — the table the ledger of model attribution should live in does not exist anywhere.
- **Why it matters**: ADR-0011 makes per-invocation logging the foundation of "the audit file proves which model said what." With no provider package, no `llm_invocations` schema, and no `reasonStructured<T>` reasoning trace store, attribution is unprovable. ADR-0010 schema-constrained extraction relies on `instructor`/`outlines` (cloud) and llama.cpp grammars (local) being plumbed; that plumbing is in `packages/llm-provider` and is not yet written.
- **Recommendation**:
  1. Author `packages/llm-provider/src/types.ts` with the five-method `LLMProvider` interface from ADR-0011 verbatim. Implement `OllamaProvider`/`VllmProvider`/`LlamaCppProvider` by wrapping `packages/llm-local`. Add `AnthropicProvider`, `OpenAIProvider` as opt-in.
  2. Add the `llm_invocations` schema as a sibling of `audit_memory_*` tables: `provider, model_name, model_hash_or_version, temperature, prompt_template_version, tokens_in, tokens_out, latency_ms, cost_usd, decision, reasoning_trace`. RLS-scoped by `firm_id`. Partition by month (ADR-0009 pattern).
  3. Build the tier router as a small switch over `TaskTier` mapped to provider+model, with per-engagement override and an air-gapped guard (`ENABLE_CLOUD_LLM=false` short-circuits at the abstraction layer, not at provider construction time).
  4. Move `packages/co-auditor/src/backend-router.ts` to consume `@auditforge/llm-provider` rather than its own `LlmBackend` interface; deprecate the local interface.

#### C4. Mode (Audit / Readiness) is not represented in the engagement domain

- **Dimension**: 9 (Mode separation)
- **ADR**: 0013
- **Architectural impact**: High
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/engagements/dto.ts` — `CreateEngagementSchema` has `clientId, stage, scopeStatement, startsOn, endsOn, leadAuditorId, teamMemberIds, metadata`. No `mode` field. `EngagementStatus` is `planned | in_progress | reporting | reviewed | issued | archived | cancelled` — applies the same flow to both modes.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/engagement/src/types/engagement.ts` — `Engagement` interface omits `mode`. `LifecycleStage` enumerates `S1, S2, Surv1, Surv2, Recert, Special`. ADR-0013 expects `Readiness` as a first-class peer, not a sub-stage.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/conversational-engine/src/types/domain.ts:18` — `AuditPhase` includes `Readiness`. So the engine has the concept but the engagement aggregate doesn't.
- **Why it matters**: ADR-0013 §"Decision" says: "Mode is selected at engagement creation and cannot change." If `mode` is not on the aggregate, there is no place for the immutability invariant to live, no projection that can rebrand UI labels (`Candidate Findings` vs `Improvement Items`), no termination logic that distinguishes "scope coverage + candidate finding review" (Audit) from "scope coverage + candidate-NC closure" (Readiness). The right-pane labels enforced via i18n keys (ADR-0013 follow-up) cannot key off something that doesn't exist.
- **Recommendation**:
  1. Add `mode: z.enum(['audit', 'readiness'])` to `CreateEngagementSchema` and `Engagement` (both API DTO and `packages/engagement` type), required at creation, immutable thereafter (no schema entry in `UpdateEngagementSchema`, plus a service-layer guard).
  2. Emit an `engagement.created` event payload that carries `mode` (extend `packages/audit-engine/src/registry.ts` event schema). The mode becomes a permanent, replay-stable property of the engagement.
  3. Branch report templates and finding routing on `mode`. The mandatory non-certification disclaimer in Readiness Mode is a property of the report-engine template, not a runtime check.

#### C5. CRDT working-papers package is built but unused; the API working-papers module is plain CRUD

- **Dimension**: 5 (CRDT offline-first)
- **ADR**: 0004
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/working-papers/src/crdt.ts` — strong, well-shaped: Y.Doc construction, snapshot encoding, transport-agnostic `CrdtProvider` interface.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/working-papers/src/conflict.ts` — well-shaped reconcile logic for non-mergeable `verdict` and `confidence` fields; severity-ordered suggestions.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/working-papers/working-papers.service.ts` — never imports from `@auditforge/working-papers`. Just CRUD over an in-memory map. No reconcile flow, no Yjs snapshot endpoint, no provider binding.
- **Why it matters**: ADR-0004 §Decision: "Working papers, findings drafts, observation notes, and interview notes use Yjs CRDTs." The contract is in the package, the provider interface is correct (transport-agnostic), but the API has no path that exposes it. This is the gap that turns ADR-0004 into vapor.
- **Recommendation**:
  1. Add a `WorkingPapersCrdtModule` in `apps/api` that exposes (a) a snapshot-fetch endpoint, (b) a `y-websocket`-compatible WebSocket route or a Hocuspocus-bridged route, (c) a `POST /working-papers/:id/reconcile` that calls `reconcileSnapshots` and writes the resolved snapshot.
  2. Have the existing `working-papers.repository.ts` persist `content: string` (base64-encoded `Y.Doc` via `encodeSnapshot`) plus the projected `verdict`/`confidence` columns from the meta map (read-only projection, not authoritative). Authoritative state is the encoded update.
  3. Emit `working_paper.updated` ledger events (already registered in `packages/audit-engine/src/registry.ts:100`) with the new `verdict`/`confidence` so the audit ledger captures every accepted update (ADR-0004 §Compliance Implications).

---

### HIGH

#### H1. AuditTrailInterceptor emits asynchronously after the response, not inside the same DB transaction as the mutation

- **Dimension**: 3 (Event sourcing correctness)
- **ADR**: 0002
- **Architectural impact**: Medium
- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/audit-trail.interceptor.ts:35-58`
- **Detail**: The interceptor uses `next.handle().pipe(tap({ next: (result) => { ...void this.ledger.append(...) } }))`. The append is a fire-and-forget side effect after the controller has returned the response. It also runs outside the DB transaction the repository used. With a real ledger (post-C1), an exception during ledger insert leaves a state mutation in the projection table that has no corresponding event. ADR-0002 §Decision: "Read models (the operational tables) are projections rebuilt from the ledger." Today the projection can outlive the event, breaking replay invariants.
- **Recommendation**: Move the `ledger.append` inside the same Postgres transaction the repository uses (transactional outbox), or keep it outside and add a relaisser that detects orphaned projections at startup. Outbox is preferred because it fits the existing `BaseRepository.withTenant` shape.

#### H2. `BaseRepository.withTenant` re-implements RLS plumbing instead of using `packages/tenancy-core`

- **Dimension**: 4 (Tenancy)
- **ADR**: 0003
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/db/base.repository.ts:19-29` issues `SET LOCAL app.current_firm_id = ...` directly in code.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/tenancy-core/src/context.ts:14-31` is the canonical implementation calling `SELECT set_tenant_context(...)`.
- **Detail**: Two different code paths for the same security primitive. They are subtly inconsistent: the package uses a `set_tenant_context` SQL function (so policy logic can change without touching app code), the API hand-rolls `SET LOCAL` GUCs (so policy logic is implicit in the variable names). Once C2 is fixed, this divergence will produce drift between the documented surface (the package) and what the API actually executes.
- **Recommendation**: Inject `@auditforge/tenancy-core`'s `withTenantContext` and remove the inline `SET LOCAL`. Kill the `TenancyAdapter` shim entirely.

#### H3. Workspace package `packages/llm-cloud` is empty but `apps/api` does not depend on it; the consent flow is not wired end-to-end

- **Dimension**: 6 (LLM provider abstraction)
- **ADRs**: 0005, 0011
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/co-auditor/co-auditor.service.ts` — pure CRUD; no `invoke`, no `accept`/`reject`, no `consent` lookup, no `backend` choice.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/co-auditor/dto.ts` — `CreateCoAuditorDto` has only `name` + `metadata`. No `taskType`, `backend`, `consentRecordId`, `systemPrompt`, `userInput`.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/co-auditor/src/invocation.ts` — fully shaped `CoAuditorService.invoke/accept/reject` with prompt fencing, schema validation, ledger emission. None of it is reachable from the API.
- **Why it matters**: ADR-0005 §Decision: "Every cloud-LLM call carries a logged consent reference and is recorded in the audit ledger as an 'AI-assisted, auditor-confirmed' event." This invariant lives only in the package; the API surface that auditors will actually call does not invoke the package. So the consent-and-ledger guarantee is unenforced from the outside.
- **Recommendation**: Reshape `apps/api/src/modules/co-auditor/` so the controller exposes `POST /co-auditor/invoke`, `POST /co-auditor/:id/accept`, `POST /co-auditor/:id/reject`. Service delegates to `packages/co-auditor`'s `CoAuditorService`. Persist `co_auditor_invocations` rows with a Drizzle repository wrapping `InvocationRepo`.

#### H4. Worker tier has no entrypoint or processors; concurrency caps and per-tenant fairness are absent

- **Dimension**: 11 (Deployment topologies), 13 (Scalability)
- **ADRs**: 0001, 0007
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/worker/src/` contains only `config/config.ts`, `sandbox/policy.ts`, `sandbox/policy.spec.ts`, `schemas/jobs.ts`. No `main.ts`, no BullMQ `Worker`, no probe handler, no AV/OCR/report-render/archive-freeze handlers.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/worker/package.json` references `node dist/main.js` and `tsx watch src/main.ts` — neither file exists.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/queue/queue.module.ts:10-21` declares ten queues; nobody consumes any of them.
  - `apps/api/src/modules/probes/probes.service.ts:31-37` enqueues `execute` to `probe-execution`. Without a worker, the job is dropped silently after retries.
- **Why it matters**: ADR-0001 §Decision: "A separate worker process (BullMQ) handles probe execution, trace ingest, AV scans, evidence OCR, and report rendering." Helm charts already provision a `worker-deployment.yaml` with autoscaling and a custom `probe_queue_depth` external metric. The architecture exists; the implementation does not.
- **Recommendation**:
  1. Author `apps/worker/src/main.ts` that constructs typed BullMQ workers per queue name, wires `@auditforge/probe-engine` → `ProcessSandbox` (dev) or `apps/worker/sandbox/policy.ts` (prod) with the egress allowlist.
  2. Add per-tenant concurrency in BullMQ via `Worker(...{ limiter: { groupKey: 'firmId' } })` plus a `concurrency` cap, and surface tenant-budget runaway as a Prometheus alert. ADR-0007 demands "per-engagement budget tracking."
  3. The existing `ProcessSandbox` (`packages/probe-engine/src/sandbox.ts:117`) is correctly labelled "production code MUST use the worker sandbox." Make sure prod path uses Linux namespaces / seccomp / NetworkPolicy as Helm `worker.volumes.probe-sandbox` already implies; today there is no such enforcement code.

#### H5. Health-check paths drift between API and Helm probes

- **Dimension**: 11 (Deployment topologies), 12 (Operability)
- **ADR**: n/a (operational constraint)
- **Architectural impact**: Low
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/health/health.controller.ts:21,28` exposes `GET /healthz` and `GET /readyz`.
  - `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/values.yaml:120,127,133` configures probes as `path: /healthz/live` and `path: /healthz/ready`.
- **Why it matters**: With the chart as written, every API pod will fail liveness probe at startup and Kubernetes will CrashLoop the API. This is a fail-shut deploy gap that masks every other issue.
- **Recommendation**: Pick one. Recommend keeping `/healthz` and `/readyz` (RFC 8615-ish), update `values.yaml` defaults. Or rename API endpoints to `/healthz/live`, `/healthz/ready`. Add an integration test that asserts `path` parity.

#### H6. `infra/observability/grafana-dashboards/` and `infra/observability/otel-collector-config/` are empty directories

- **Dimension**: 12 (Operability)
- **Architectural impact**: Medium
- **Files**: both directories exist with zero files.
- **Why it matters**: `apps/api/src/main.ts` boots `startOtel` and the API exposes Prom metrics on `/metrics`. The Helm chart references `http://otel-collector.observability.svc.cluster.local:4318` and a `ServiceMonitor`. Without dashboards or a collector config, observability is on-by-default with no destination and no visualization. Anyone deploying the chart cannot answer "what is the API doing right now?"
- **Recommendation**: Add at minimum:
  1. `infra/observability/otel-collector-config/otel-config.yaml` with OTLP/HTTP receiver and an exporter (e.g. tempo+prom, or Jaeger+Loki).
  2. `infra/observability/grafana-dashboards/api-overview.json` (request rate, p95 latency, error rate, throttle hits per tenant).
  3. `…/probe-runner.json` (queue depth per queue, processing rate, sandbox outcome distribution, budget burn-down per tenant).
  4. `…/audit-ledger.json` (events/sec per tenant, chain verify pass/fail, TSA stub vs real provider).

#### H7. `infra/terraform/` is documented as "Phase 14 cloud baselines" but has no module code

- **Dimension**: 11 (Deployment topologies)
- **Architectural impact**: Low (Phase-14 is correctly out-of-scope today; this is severity-flagged so it doesn't slip)
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/infra/terraform/README.md` references `modules/aws-baseline`, `modules/azure-baseline`, `modules/gcp-baseline`, `modules/auditforge-eks`, `environments/dev`, `environments/prod` — none of which exist.
  - The directory contains only `.checkov.yml`, `.tflint.hcl`, `.tfsec.yml`, `.terraform-version`, `README.md`.
- **Why it matters**: Documentation promises capability the repo does not deliver. Either remove the README entries (and add a clear "TODO Phase 14" stub), or check in placeholder modules with a `version = "0.0.0"` and an explicit `not-for-production` warning.
- **Recommendation**: Mark the README as Phase-14 work-in-progress and gate any "AWS/Azure/GCP/OCI baseline" claim in marketing material on actual module existence.

#### H8. No bi-temporal "AS OF" query / point-in-time service is wired into the API; the package is built but isolated

- **Dimension**: 7 (Bi-temporal claim graph)
- **ADR**: 0009
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/audit-memory/src/services/point-in-time.ts` (referenced from `services/index.ts`) — implements bi-temporal queries.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/audit-memory/src/services/claim-graph.ts:182-216` — `traverse` is in-memory BFS over `listClaimRelations()` (loads all relations per hop). It is correct for a unit test, but it bypasses the ADR-0009 promise of "recursive CTEs against properly indexed adjacency tables." When migrated to Postgres this needs to become a `WITH RECURSIVE` query.
  - There is no `apps/api/src/modules/audit-memory/` (or equivalent) controller exposing `GET /claims?asOf=...&engagementId=...`.
- **Why it matters**: ADR-0009 §Decision specifically rejects Neo4j "because Auditor reconstruction queries become 'AS OF' CTEs against a single store." The package implements the data model; the application surface does not let the auditor reconstruct anything. Until the API exposes point-in-time, the auditor-defensibility argument that motivates ADR-0009 is theoretical.
- **Recommendation**: Add a NestJS module `audit-memory` in `apps/api/src/modules/`, depending on `@auditforge/audit-memory`, with an `at` query parameter that delegates to `PointInTime` service. Land the recursive CTE in a Drizzle migration (`packages/db/drizzle/`) and replace the in-memory traversal with a SQL one.

#### H9. Schema-constrained extraction (ADR-0010) lives in `audit-memory` but the engine and CI probe don't enforce it

- **Dimension**: 6 (LLM provider), 8 (Engine outputs as drafts)
- **ADR**: 0010
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/audit-memory/src/services/schema-registry.ts` is the validator.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/conversational-engine/src/` contains `question-generator/`, `question-library/`, but the file tree shows `attribution/`, `adaptive-evolution/`, `coverage-tracker/`, `db/` are present as directories yet with very few files (only `question-generator/scope-resolver.ts`, `prioritizer.ts`, and `question-library/loader.ts`, `index.ts` were found).
  - Repo-wide grep finds no probe `P-AF-CLAUSE-01` (ADR-0010 §Follow-Ups).
- **Why it matters**: ADR-0010 makes "outputs that fail schema validation are logged in `extraction_invocations` but not stored as claims" the difference between a defensible audit memory and graph noise. Without the engine wired to the registry and without the CI probe, this guard exists in code but is unguarded.
- **Recommendation**: 
  1. Author `packages/conversational-engine/src/attribution/` modules that consume `@auditforge/audit-memory`'s `SchemaRegistry` and `@auditforge/llm-provider` `classifyStructured<T>` (after C3).
  2. Add `tests/probe-validity/p-af-clause-01.test.ts` that exercises the re-ranker on a sample catalog and asserts every emitted clause ID exists. Run it in CI.

---

### MEDIUM

#### M1. Cross-framework module in `apps/api` is plain CRUD; the package's coverage calculator is unused

- **Dimension**: 10 (Cross-framework)
- **ADR**: 0008
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/cross-framework/src/coverage.ts` — implements `computeCoverage` with directed-graph traversal across frameworks.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/cross-framework/cross-framework.service.ts` — pure CRUD over `name`/`metadata`.
- **Recommendation**: Have the API service delegate `GET /cross-framework/coverage?targetFramework=EU_AI_ACT` to the package's `computeCoverage` with a verdict feed from the working-papers projection. Persist methodology choices in the audit ledger so coverage is not a black box (ADR-0008 §"Methodology in audit ledger, not black box").

#### M2. Event schema registry covers v2 events but not v3 (engine, memory, llm-invocation)

- **Dimension**: 3 (Event sourcing), 14 (Reversibility)
- **ADR**: 0002
- **Architectural impact**: Medium
- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/packages/audit-engine/src/registry.ts:47-191`
- **Detail**: `createDefaultRegistry` registers `firm.created, auditor.invited, …, co_auditor.invoked` — all v2. No `engine.candidate_finding.drafted`, `engine.candidate_finding.promoted|dismissed`, `engine.attribution.confirmed`, `claim.invalidated`, `llm.invocation.recorded`, `mode.set`, `engine.contradiction.surfaced`. Without those, ADR-0012's "every state transition has a human decision trail" cannot be satisfied for engine outputs.
- **Recommendation**: Add a v3 event pack (`registry.v3.ts` or further `register(...)` calls) covering each engine-confirmed transition. Each event must carry `schemaVersion` so future schema evolution does not break replay (ADR-0002 §Negative).

#### M3. No documented "in-process bus contract" (ADR-0001 follow-up)

- **Dimension**: 2 (Modular monolith discipline)
- **ADR**: 0001
- **Architectural impact**: Medium
- **Detail**: ADR-0001 §Follow-Ups: "Document the in-process bus contract." There is no such document, and modules communicate today only through Nest DI of singletons. Once modules are real (post-C1), they will reach into each other's repositories or services unless a bus contract exists. This is the classic pre-microservices mistake.
- **Recommendation**: Author `docs/architecture/in-process-bus.md` with: (1) a `ModuleEvent<T>` shape, (2) a `Bus.publish(event)` contract that fans out to subscribers in the same DB transaction, (3) a rule that cross-module reads go through a "read-port" interface that returns a typed DTO (no entity import across modules). Enforce with an `eslint-plugin-boundaries` rule (ADR-0001 follow-up).

#### M4. No drizzle migrations exist; reversibility is unestablished

- **Dimension**: 14 (Reversibility)
- **Architectural impact**: Medium
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/db/drizzle/` is empty.
  - `c:/Users/ekess/Downloads/iso42001auditforge/packages/db/drizzle.config.ts` points `out: './drizzle'`.
  - `infra/postgres-init/01-extensions.sql` is the only DDL committed.
- **Why it matters**: ADR-0002 commits to a 10-year retention horizon and "Schema evolution requires versioned event types." That is impossible without a migration story (up/down/up tested). The audit-memory package defines `pgTable(...)` schemas in code but they have not been emitted to migrations and there is no down path.
- **Recommendation**: Run `drizzle-kit generate:pg` against the union of `packages/db/src/schema` and `packages/audit-memory/src/db/schema.ts`. Commit the result. Add a CI step that runs `drizzle-kit check` and a Testcontainers test that exercises up→down→up.

#### M5. `EngagementsService` allows transitions like `reviewed → reporting`; finite-state-machine semantics are loose

- **Dimension**: 3 (Event sourcing correctness)
- **ADR**: 0002
- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/engagements/engagements.service.ts:7-15`
- **Detail**: `reviewed: ['issued', 'reporting']` permits a backwards transition. ADR-0002 events are immutable, but if the projection allows oscillation, the replay state machine becomes ambiguous. Either the transition should be modelled explicitly (`engagement.reverted_to_reporting`) or disallowed.
- **Recommendation**: Promote the FSM to a typed state machine with explicit reversal events; emit `engagement.transitioned` with `from`, `to`, and `reason` so the ledger reflects the cycle.

#### M6. Fastify body-size limit set to 5 GiB at app level; per-tenant rate limiting is IP+firm based but no per-route quota

- **Dimension**: 13 (Scalability), security adjacency
- **Files**:
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/main.ts:43` — `fileSize: 5 * 1024 * 1024 * 1024`.
  - `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/throttler.config.ts` — single global `{ ttl, limit }`.
- **Detail**: Evidence vault uploads probably need a generous body cap, but applying it globally lets any controller accept a 5 GiB body. The throttler keys per `firm:ip` with one limit; it does not differentiate `POST /probes/:id/execute` (expensive) from `GET /engagements`.
- **Recommendation**: Bind the `5 GiB` limit only to `POST /evidence-vault/upload`. Apply a tighter default to other routes via `fastifyMultipart`'s route options. Define per-route rate-limit policies (probe execution: low burst; reads: high burst; auth endpoints: very low).

#### M7. `idempotency-key` cache is in-process and global

- **Dimension**: 13 (Scalability)
- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/idempotency.interceptor.ts:10-12,19-25`
- **Detail**: A single Map per pod with 24-hour TTL gives no idempotency guarantee across replicas (the API HPA scales to 10 in `values.yaml`). Two requests with the same key landing on different pods will both execute.
- **Recommendation**: Move the cache to Redis keyed by `firm:url:key` with TTL.

#### M8. Probe budget enforcement uses a global `PROBE_BUDGET_DEFAULT_USD` env var; ADR-0007 mandates per-engagement budget

- **Dimension**: Sandbox / probe runner
- **ADR**: 0007
- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/probes/probes.service.ts:25-30` reads `this.cfg.PROBE_BUDGET_DEFAULT_USD`.
- **Detail**: One static cap for the whole deployment. ADR-0007 §Decision: "per-engagement budget tracking (cost ceiling for live probes; running total visible to the lead auditor)." Different engagements have different ceilings (some bring their own LLM bill).
- **Recommendation**: Add an `engagement.probe_budget_usd` column (or a `probe_budgets` table) and source the cap from there, falling back to the default env var.

#### M9. Air-gapped Helm values exist (`values-airgapped.yaml`) but the API config does not enforce air-gapped mode at the LLM-provider abstraction layer

- **Dimension**: 11 (Deployment topologies), 6 (LLM provider)
- **ADR**: 0011
- **Detail**: `apps/api/src/config/config.schema.ts:45` has `ENABLE_CLOUD_LLM` but no `AIR_GAPPED_MODE`. ADR-0011 "air-gapped deployments disable cloud providers at the abstraction layer" requires the abstraction layer to refuse construction of cloud providers when the deployment is marked air-gapped, not just to flip a feature flag the developer can also flip.
- **Recommendation**: Add `AUDITFORGE_DEPLOYMENT_MODE: 'standard' | 'air-gapped'` and assert at provider-factory time that no cloud provider can be instantiated in air-gapped mode. Surface in `/healthz/ready` so operators see deployment mode.

---

### LOW

#### L1. `eslint.config.mjs` has no boundary plugin

- **ADR**: 0001 follow-up
- **Detail**: No `eslint-plugin-boundaries` configured. ADR-0001's only structural CI guard is missing. Once C1/C2/M3 land, this is the difference between "respected boundaries" and "hidden cross-module imports two refactors from now."
- **Recommendation**: Add `eslint-plugin-boundaries` with element zones `app | module | package | shared`, and rules that forbid `app → module`-internal, `module → module`-internal, and `package → app` imports.

#### L2. License-check enforces SPDX in source files but not in Markdown / YAML

- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/scripts/license-check.mjs:12-20` — `CHECK_EXTS` excludes `.md`, `.yml`, `.yaml`, `.json`.
- **Detail**: Helm templates and Markdown ADRs do carry the SPDX identifier in comments; consider including `.yaml`/`.yml` to enforce it for new chart files. Drift is otherwise easy.
- **Recommendation**: Extend `CHECK_EXTS` for `.yaml`/`.yml`. Allow `# SPDX-…` or `{{/* SPDX-… */}}` matchers.

#### L3. `signed-action.interceptor.ts` does not actually verify WebAuthn

- **File**: `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/signed-action.interceptor.ts:23-28` — `// TODO(phase-1): verify attestation signature against challenge using @simplewebauthn/server.`
- **Detail**: Today any non-empty 16+ char string in `x-webauthn-attestation` passes. ADR-0006 §Decision binds the lead auditor's hardware-backed credential at first login and signs at issuance. The interceptor is a placeholder.
- **Recommendation**: Replace with a real `@simplewebauthn/server` verification keyed by a per-auditor stored credential and a server-issued challenge. Log to `auditor_signing_attempts` table.

#### L4. No CHANGELOG entries since v0.0.1; ADR-0006 follow-up jobs (renewal runbook) not present

- **Files**: `CHANGELOG.md` is empty; no `docs/runbooks/`.
- **Recommendation**: Create `docs/runbooks/signature-renewal.md` aligned with ADR-0006 §Follow-Ups. Adopt Conventional Commits + Changesets so CHANGELOG fills automatically.

#### L5. Worker `apps/worker/src/sandbox/policy.ts` is a TS file, not the canonical policy from `packages/probe-engine/src/sandbox.ts`

- **Files**: `apps/worker/src/sandbox/policy.ts` (not inspected in detail), `packages/probe-engine/src/sandbox.ts` defines `SandboxPolicySchema` and `policyFromBudget`.
- **Detail**: The package has the contract; if the worker has its own policy.ts shape it will drift.
- **Recommendation**: Have the worker import `SandboxPolicySchema` from `@auditforge/probe-engine` (which the worker already lists in `package.json` via `@auditforge/audit-engine`; add `probe-engine` likewise).

#### L6. `apps/api/src/main.ts` registers `@fastify/multipart` with `fileSize: 5 GiB` and no `attachFieldsToBody` policy; OpenAPI exposes `idempotency-key` and `x-webauthn-attestation` as API-key auth

- **Detail**: Cosmetic. Idempotency-Key is a header-based mechanism, not auth; using `addApiKey` here misleads SDK generators.
- **Recommendation**: Use `addGlobalParameters` for header parameters; reserve `addApiKey` for credentials.

#### L7. Conversational-engine and nc-drafter packages exist but with skeleton subdirectories only; many declared dirs (e.g. `attribution`, `adaptive-evolution`, `coverage-tracker`, `db`) are empty

- **ADRs**: 0010, 0012
- **Detail**: Phase 7.6/7.7 are explicitly listed as "in progress" by `CLAUDE.md`. Severity is Low because intent is documented; flag here so it does not slip past readiness review without explicit gate satisfaction.
- **Recommendation**: Track per-phase ADR coverage in `docs/architecture/phase-coverage.md` so each phase's exit criteria are visible.

---

### INFO / OBSERVATIONS

#### I1. ADRs are well-structured and consistent

- The 13 ADRs share a uniform template, are consistent with each other (e.g. ADR-0011 explicitly extends ADR-0005), and link clearly to compliance clauses (ISO 17021-1, ISO 42001 Annex, EU AI Act, GDPR). This is unusually good architectural hygiene.

#### I2. `packages/audit-engine` is the strongest implemented surface

- Hash-chained ledger, canonical JSON, monotonic per-tenant sequence, registry-validated payloads, replay reducer, in-memory tamper-test seam — clean. Once C1/M2 land, this becomes the spine of the system. Keep it pristine; do not let API conveniences leak in.

#### I3. `packages/working-papers` reconcile design is correct

- Severity-ordered verdict suggestion, "more pessimistic confidence wins" suggestion, and `clampVerdictByStateMachine` are exactly the right shape for the offline-first audit world. The miss is wiring (C5).

#### I4. `packages/audit-memory` schema is comprehensive (bi-temporal, schema-versioned, RLS-friendly columns)

- The Drizzle schema in `packages/audit-memory/src/db/schema.ts` already includes `firmId`/`engagementId` on every table, GIN trigram on `object`, ivfflat on `embedding`, and a separate `claim_temporal` ledger. This anticipates ADR-0009 and ADR-0010 well. Recursive-CTE traversal is the next piece (H8).

#### I5. Helm chart is production-leaning

- `values.yaml` defaults have `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `capabilities.drop: [ALL]`, `seccompProfile: RuntimeDefault`, NetworkPolicy default-deny, PDB enabled, ServiceMonitor + PrometheusRule scaffolded. `values-prod.yaml` and `values-airgapped.yaml` exist. Probe-path mismatch (H5) is the only blocker; everything else is good baseline hygiene.

#### I6. Phase-1 `TODO` markers are visible and consistent

- `apps/api/src/adapters/audit-engine.adapter.ts` and `tenancy.adapter.ts` both carry `TODO(phase-1)` markers that name the package they should be replaced with. The intent is clear; only the wiring is missing.

#### I7. Audit-trail interceptor wisely uses metadata + entity-id parameter resolution

- The `@AuditTrail({ type, entity, entityIdParam })` decorator pattern in `apps/api/src/common/audit-trail.interceptor.ts:21` is the right shape; once H1 (transactional outbox) is fixed, this will scale cleanly.

#### I8. Per-tenant throttler tracker is correct in shape

- `TenantThrottlerGuard.getTracker = ${firm}:${ip}` (`apps/api/src/common/throttler.config.ts`) is the right key. Pair with M6 (per-route policies) for full effect.

---

## Recommended remediation order

The findings above are ordered by severity, but architectural sequencing matters. The sane order to address them is:

1. **C2** (DB-level RLS + `set_tenant_context` migration) — required before anything else touches Postgres.
2. **M4** (drizzle migrations exist, up/down/up tested) — same migration pass as C2.
3. **C1** (replace adapters with packages, replace `Map`-backed repos with Drizzle repos, do `engagements` first as the template, plus L1 boundary lint).
4. **H1, H2** (transactional outbox + tenancy-core helper) on the back of C1.
5. **C4** (mode field on engagement) and **M2** (v3 event schemas) — small, high-leverage.
6. **C3** (LLM provider package + `llm_invocations` table).
7. **H3, H9** (co-auditor + extraction wired through ADR-0011 / ADR-0010 plumbing).
8. **C5, H8** (CRDT working-papers + audit-memory point-in-time wired into API).
9. **H4** (worker app: real BullMQ workers, sandbox, per-tenant concurrency).
10. **H5, H6, H7** (operability: probe paths, observability artefacts, terraform stubs).
11. **M1, M5–M9, L1–L7** in any order; mostly hygiene and follow-through.

Each step preserves replayability of the ledger going forward; each step is independently testable.

---

## ADR fidelity matrix

| ADR | Status in code | Notes |
|---|---|---|
| 0001 modular monolith | Partial | Boundary intent honoured at the package level. API does not consume packages (C1). No bus contract documented (M3). No boundary lint (L1). |
| 0002 event-sourced ledger | Partial (package only) | Strong package; not connected to API (C1). Schema registry is v2-only (M2). Audit-trail emit is not transactional (H1). No `audit_ledger_events` table (M4 / C1). |
| 0003 Postgres RLS | **Not enforced at DB** (C2) | App layer issues `SET LOCAL`, but no policies, no migrations, no RLS bypass tests. RLS test is a stub. |
| 0004 offline-first CRDT | Package only (C5) | `working-papers` package well-shaped; API does not expose CRDT or reconcile. |
| 0005 local-LLM default | Conceptually present | `ENABLE_CLOUD_LLM` flag exists; consent flow not wired (H3); air-gapped is values-file only (M9). |
| 0006 signed audit file | Partial | TSA stub correctly named "placeholder"; WebAuthn verification is a stub (L3); no CAdES/PAdES library plumbed yet. |
| 0007 modular probe runner | Package only (H4) | `probe-engine` strong; worker missing entrypoint; budget is global env var (M8). |
| 0008 cross-framework | Package only (M1) | Coverage calculator unused by API. |
| 0009 bi-temporal claim graph | Schema present, queries not exposed (H8) | `audit-memory` package has solid schema; no API surface; recursive CTE not yet in SQL. |
| 0010 schema-constrained extraction | Package only (H9) | SchemaRegistry exists; engine and CI probe (`P-AF-CLAUSE-01`) missing. |
| 0011 LLM provider abstraction | **Empty package** (C3) | `packages/llm-provider/src/{db,providers,routing,templates}` are zero-byte. |
| 0012 engine outputs as drafts | Package only (L7) | `nc-drafter`'s promotion service exists; engine pipeline incomplete. |
| 0013 mode separation | **Not encoded** (C4) | `mode` not on engagement aggregate (API or package). |

---

## Closing note

The ADRs and packages collectively describe a coherent, defensible architecture. The implementation has been **vertically thin** so far: most packages exist, most ADRs are decided, but the application that ties them together (`apps/api`, `apps/worker`) is largely a CRUD facade against in-memory state. Closing C1–C5 + H1–H9 in the order above turns the paper architecture into a running one without changing any ADR. None of the findings here suggests a redesign; every finding suggests catching the implementation up to the existing design.

Once that catch-up is done, a follow-up review should focus on:

- Replay correctness on real Postgres (`audit-engine.replay` against `audit_ledger_events`).
- RLS bypass attempts using actual Postgres roles.
- LLM provider parity tests (ADR-0011 §Follow-Ups).
- Multi-region archive + signature renewal paths (ADR-0006 §Follow-Ups).
- Cross-engagement memory (Phase 15) once mode-separation invariants are firm.
