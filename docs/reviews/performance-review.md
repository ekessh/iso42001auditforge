# Performance Review (Date: 2026-05-03)

Scope: AuditForge ISO 42001 monorepo. Read-only review focused on N+1 patterns, indexing, bi-temporal queries, streaming parsing, probe & LLM cost control, CRDT sync overhead, k6 SLO assertions, caching, worker concurrency, frontend perf, connection pooling, and real-time push.

Targets restated:

- p95 API latency < 200 ms (working-paper edits)
- p95 < 2 s (10 MB upload), p95 < 500 ms (probes), p95 < 5 s (reports), p95 < 10 s (100k-span trace ingest)
- audit-ledger durability 99.999 %, signing pipeline 99.9 %, probe-runner availability 99 %

## Executive summary

- **Overall posture: not yet on a credible path to the SLOs.** The runtime data layer is dominated by in-process `Map` stubs, which means the API will trade an in-memory hashmap lookup for production durability but never both. Specifically: every NestJS repository under `apps/api/src/modules/**/` (22 files), the audit-engine ledger, the trace ingestor, the working-paper registry, the search indexer, the audit-memory store, the probe budget controller and the idempotency interceptor all retain their data in `Map` instances in process memory. Until those are swapped for the (unfinished) Postgres-backed implementations, any "p95 < 200 ms" measurement is meaningless because the workload is not representative of production. Several of the described durability targets (99.999 % ledger, 99.9 % signing) are physically impossible against this storage choice. The pieces that **are** in good shape are the schema indexes that already exist on `packages/audit-memory/src/db/schema.ts`, the streaming JSON helper, the Helm `prometheus-rule` SLO definitions, and the k6 scenario list — but each of those has caveats called out below. Observability has zero wired-up infrastructure: `infra/observability/grafana-dashboards`, `infra/observability/otel-collector-config`, and `tests/load/lib` are empty directories, the `apps/worker/src/processors` directory is empty, and the metrics referenced by `infra/helm/auditforge/templates/prometheusrule.yaml` (e.g., `auditforge_ledger_chain_verify_failures_total`, `auditforge_probe_budget_used`, `auditforge_rls_bypass_total`) are not emitted by any source file in the repo.
- **Blockers: 6**
- **Highs: 13**
- **Mediums: 9**
- **Informational: 5**
- **SLOs without instrumentation: see [SLO instrumentation gap](#slos-without-instrumentation) at the end.**

---

## Findings

### BLOCKER #1 — Bi-temporal point-in-time query is N+1 against full claim set; will not meet 100k-claim target

- File: `packages/audit-memory/src/services/point-in-time.ts:26-57`
- Issue: `PointInTimeQuery.asOf()` calls `store.listClaims(ctx)` which loads the entire engagement's claim set into memory, then for every claim issues a separate `store.listClaimTemporal(ctx, claim.id)` query, then sorts the per-claim history in JS, then filters by ingestion time and event-time-start in JS. At the design target of 100,000 claims per engagement this is ≥ 100,001 round-trips and ≥ 100,000 sort calls, plus full-table reads. None of the existing indexes on `audit_memory_claims` (`audit_memory_claims_event_time_ix`, `audit_memory_claims_ingestion_ix`) are ever used because the query never reaches SQL.
- Impact: The bi-temporal "as-of" query — the highest-value capability of the audit-memory layer — degenerates to an O(N) network and DB walk. p95 will be many seconds at 100k claims, not the implied sub-second. SLO `p95 < 5 s` for any user-facing AS-OF view is unreachable.
- Recommendation: Push the predicate into a single SQL CTE. Sketch (one round-trip):

  ```sql
  WITH live AS (
    SELECT DISTINCT ON (claim_id) claim_id, validity, event_time_end, recorded_at
    FROM   audit_memory_claim_temporal
    WHERE  engagement_id = $1 AND recorded_at <= $2
    ORDER  BY claim_id, recorded_at DESC
  )
  SELECT c.*, l.validity AS validity_at_ts, l.event_time_end AS end_at_ts
  FROM   audit_memory_claims c
  JOIN   live l ON l.claim_id = c.id
  WHERE  c.engagement_id = $1
    AND  c.ingestion_time <= $2
    AND  c.event_time_start <= $2
    AND  ( $3::bool OR l.validity = 'active' );
  ```

  Add `(engagement_id, recorded_at)` index on `audit_memory_claim_temporal` (only `(claim_id)` exists today at `packages/audit-memory/src/db/schema.ts:270`). Consider materialised `claim_state_at(engagement_id, claim_id, ts)` cache in Redis for hot AS-OF timestamps.
- Owner: `packages/audit-memory/src/services`, `packages/audit-memory/src/db/schema.ts`

### BLOCKER #2 — Every `apps/api` repository is an in-memory `Map`; no SLO measured against the in-memory path is meaningful

- File: 22 files matching `apps/api/src/modules/**/*.repository.ts`. Examples: `apps/api/src/modules/working-papers/working-papers.repository.ts:10-46`, `apps/api/src/modules/findings/findings.repository.ts:10-37`, `apps/api/src/modules/probes/probes.repository.ts:10-67`, `apps/api/src/modules/evidence-vault/evidence-vault.repository.ts:10-46`, `apps/api/src/modules/engagements/engagements.repository.ts:10-45`. All extend `BaseRepository` (`apps/api/src/db/base.repository.ts`) but never call `this.sql` — every read/write is `this.memory.get/set`.
- Issue: `list()` does `Array.from(map.values()).filter(...)` plus `findIndex(cursor)` per page request — O(N) per page even with cursor; cursor pagination is broken because `findIndex` walks the whole array, defeating the design goal of cursor-based pagination. Across multi-replica deployments the data is *partitioned per replica* (no sharing, no consistency); a write to replica A is invisible from replica B. Restart loses everything.
- Impact: (1) k6 results are unrepresentative — the `wp-edit-100` scenario currently exercises the in-memory `Map` fast path (which can do millions of ops/s on a single replica) and never touches Postgres or the RLS-via-`SET LOCAL` overhead. The reported p95 in such a run will be unrealistically good. (2) Once the Postgres backing is wired in, every endpoint will incur (a) `BEGIN`, (b) 2-3 `SET LOCAL` round-trips, (c) the actual query, (d) `COMMIT` — a baseline of ~2-4 ms per request *before* any actual workload, which is a meaningful chunk of the 200 ms budget. (3) Durability targets cannot be met with `Map`.
- Recommendation: (a) Treat the 22 repositories as TODO list and implement Drizzle-backed versions. (b) Replace `BaseRepository.withTenant` (`apps/api/src/db/base.repository.ts:19-29`) with a single `set_config()` call (see Medium #1 below) to halve session-setup round-trips. (c) Add at minimum one `(firm_id, engagement_id)` composite index and one `(firm_id, created_at DESC)` index on each business table; today only `auditors`, `auditor_assignments` etc. have indexes (`packages/db/src/schema/auditors.ts:34-122`) and even there only single-column. (d) Add a CI gate that fails the build if a `*.repository.ts` file declares `private readonly memory = new Map`.
- Owner: `apps/api/src/modules/**`, `packages/db/src/schema`

### BLOCKER #3 — Audit ledger is in-memory only; 99.999 % durability target unattainable

- File: `packages/audit-engine/src/ledger.ts:51-88` (`InMemoryEventRepository`), `apps/api/src/adapters/audit-engine.adapter.ts:31-49` (parallel in-memory `chainTipByTenant` Map), `apps/api/src/modules/audit-ledger/audit-ledger.service.ts:10-13` (`list()` returns empty array with TODO).
- Issue: There is no Postgres-backed `EventRepository` implementation in the repo. `InMemoryEventRepository.getLatestForFirm()` does `events.filter(...).reduce(...)` (O(N) per emit) and `list()` does `filter().sort()` (O(N log N) per verify). Worse, between `getLatestForFirm()` and `insert()` (`packages/audit-engine/src/ledger.ts:119-160`) there is no concurrency control: two concurrent `emit()` calls compute the same `sequenceNumber + 1` and the second `insert()` throws `AuditLedgerCorruption`. In `apps/api/src/common/audit-trail.interceptor.ts:44-56` the interceptor does `void this.ledger.append(...).catch(...)` — fire-and-forget — so audit events are silently lost on any failure including the corruption thrown by the race above.
- Impact: 99.999 % durability requires durable, replicated storage with serializable append; today durability is bounded by the lifetime of one Node process. The fire-and-forget interceptor cannot meet that target by orders of magnitude even after storage is wired in.
- Recommendation: (a) Implement a `PostgresEventRepository` that does `INSERT INTO audit_ledger_events ... RETURNING sequence_number, chain_hash` inside a `SERIALIZABLE` transaction (or use a per-tenant advisory lock — `pg_advisory_xact_lock(hashtext($firmId))`). (b) Move chain hash computation into a Postgres trigger so app-layer code cannot drift. (c) Add a Postgres outbox table written in the same transaction as the business-state mutation; have the audit-trail interceptor poll/stream the outbox to the ledger so an in-flight crash never loses an event. (d) Replace `void ... .catch(log)` with synchronous append inside the request transaction; only POST/PUT/PATCH/DELETE need it (already filtered at line 32 of the interceptor) so the latency cost is acceptable.
- Owner: `packages/audit-engine`, `apps/api/src/common/audit-trail.interceptor.ts`, `apps/api/src/adapters/audit-engine.adapter.ts`

### BLOCKER #4 — OTel trace importer buffers entire payload then re-streams it; 100k-span SLO infeasible

- File: `packages/trace-analyzer/src/importers/trace.ts:288-334`
- Issue: The OTel importer reads the *entire* readable stream into a `Buffer`, then calls `JSON.parse(payload)` on the full string (line 294), then *re-streams* the same payload (lines 296-310) via `readableFromString(payload)` to `streamJsonArray`. The comment at lines 282-287 acknowledges the design defeats streaming. For a 100k-span OTel export (commonly 100-300 MB JSON, single-line attribute-array variant), this means: (a) a 100-300 MB string in V8 (already over the default `--max-old-space-size`), (b) a 100-300 MB parse (Node's `JSON.parse` is synchronous and blocks the event loop for several seconds at this size), (c) full re-allocation as the stream-json pipeline re-parses every span. The downstream `ctx.spans.push(span)` (lines 300, 313, 330) and Zod `AgentTraceSchema.parse(...)` (line 340) keep the entire span array in memory regardless — so the streaming code path saves no memory anyway. Langfuse (`importLangfuse`, line 387) and Phoenix (`importPhoenix`, line 483) make no streaming attempt at all.
- Impact: The k6 `trace-100k` scenario at `tests/load/scenarios/trace-100k.js` will fail with an OOM or event-loop stall before reaching the p95 < 10 s target. Even at 50k spans it likely falls over.
- Recommendation: (a) Use a streaming JSON parser that supports nested `pick` (e.g., `stream-json`'s chained pickers) to walk `resourceSpans[*].scopeSpans[*].spans[*]` without ever materialising the root JSON. (b) Drop the requirement that `AgentTrace.spans` be a single in-memory array; convert downstream consumers (`buildTimeline`, `costRollup`, `latency`, `detectAnomalies` in `packages/trace-analyzer/src/services/TraceAnalyzer.ts`) to streaming iterators that compute online statistics (Welford for variance, P² for percentiles, fixed-size ring buffer for top-N). (c) For schema validation, validate per-span and accumulate an ingest-error report rather than calling `AgentTraceSchema.parse` on the whole report at the end. (d) For Langfuse/Phoenix, prefer NDJSON exports where possible and stream them via `parseNdjson` (already implemented in `packages/llm-local/src/http.ts:173-209`).
- Owner: `packages/trace-analyzer/src/importers`, `packages/trace-analyzer/src/services/TraceAnalyzer.ts`

### BLOCKER #5 — Graph traversal in `ClaimGraph.traverse` re-fetches *all* relations once per seed per depth

- File: `packages/audit-memory/src/services/claim-graph.ts:182-216`
- Issue: Inside the BFS, line 200 calls `await this.deps.store.listClaimRelations(ctx)` for **every claim in the frontier at every depth level**, with no `claimAId`/`claimBId` filter. With `cap = min(maxDepth, 3)` and a frontier that grows fan-out × seeds, you can easily issue thousands of full-table relation fetches per `retrieve()` call. The hybrid retrieval path (`packages/audit-memory/src/services/hybrid-retrieval.ts:58`) calls `traverse` whenever `seeds.length > 0`, so every retrieval hits this.
- Impact: At any non-trivial relation count this becomes the dominant latency in the audit-memory query path, defeating the recall-vs-latency win that hybrid (BM25 + vector + graph) retrieval is supposed to deliver.
- Recommendation: (a) Pull all reachable edges in a single recursive CTE: `WITH RECURSIVE walk AS (...) SELECT ... FROM walk WHERE depth <= 3` constrained by `engagement_id`. (b) If the store layer is required to remain agnostic, fetch the full relations set *once* per `traverse()` call (line 200 should hoist outside both loops) and index by `claimAId`/`claimBId` in JS for the BFS. (c) Add an `(engagement_id, claim_a_id)` and `(engagement_id, claim_b_id)` composite — current schema only has `(claim_b_id)` at `packages/audit-memory/src/db/schema.ts:307`.
- Owner: `packages/audit-memory/src/services/claim-graph.ts`, `packages/audit-memory/src/db/schema.ts`

### BLOCKER #6 — Probe `BudgetController` is a process-local `Map`; multi-replica deployments will exceed budget

- File: `packages/probe-engine/src/budget-controller.ts:52-158`, `apps/api/src/modules/probes/probes.service.ts:23-39`
- Issue: `InMemoryBudgetController.state` is a per-process `Map`. The api `ProbesService.execute()` does `sumCostByEngagement` (an in-memory sum at `apps/api/src/modules/probes/probes.repository.ts:63-67`) then calls `queue.add(...)` then writes the execution row — three steps with no atomic guard. With even two API replicas under load, the same engagement can race two preflight checks both reading e.g. $48 spent of $50, both seeing $48 + $5 < $50 = OK, both enqueue, both end up costing $5 → $58 spent at engagement scope. There is no Redis-backed budget controller in the repo.
- Impact: The "stop spending at the engagement cap" guarantee in `docs/architecture/probe-engine.md` is voided in any HA configuration. With cloud LLM enabled (per `apps/api/src/config/config.schema.ts:45`), this is an actual cost-leak surface, not just a missed metric.
- Recommendation: (a) Replace `InMemoryBudgetController` with a `RedisBudgetController` that uses a Lua script for `INCRBYFLOAT` + threshold check + return new spent — one round-trip, atomic. (b) Lock the row used by `sumCostByEngagement` with `SELECT ... FROM probe_budgets WHERE engagement_id = $1 FOR UPDATE` inside the same transaction that inserts the execution. (c) Plumb `RedisBudgetController` into `apps/worker` as well so the worker can enforce mid-probe spend (line 226-228 of `packages/probe-engine/src/runner.ts` calls `recordSpend` only on `completed`, so OOM/wallclock-timeouts don't record partial spend).
- Owner: `packages/probe-engine/src/budget-controller.ts`, `apps/api/src/modules/probes/probes.service.ts`

---

### HIGH #1 — Idempotency cache is unbounded in-process `Map`; eventual OOM and cross-replica gap

- File: `apps/api/src/common/idempotency.interceptor.ts:9-32`
- Issue: `cache: Map<string, CacheEntry>` grows forever. The 24h TTL is *only* checked on `get` (line 20) — entries that never receive another request stay in the map forever. Multi-replica means two clients with the same Idempotency-Key on different replicas both execute (idempotency lost).
- Recommendation: Move to Redis with `SET key value EX 86400 NX` for the de-dup token and a separate `SET payload EX 86400` for the response body; serialize body via a stable JSON canonicaliser (`packages/audit-engine/src/hash.ts:6-20` already provides one).

### HIGH #2 — `BaseRepository.withTenant` issues 3-4 round-trips per request just to set RLS context

- File: `apps/api/src/db/base.repository.ts:19-29`, `apps/api/src/adapters/tenancy.adapter.ts:22-28`
- Issue: Every repository call wraps the body in `this.sql.begin(async (tx) => { await tx\`SET LOCAL ...\`; await tx\`SET LOCAL ...\`; if (engagementId) await tx\`SET LOCAL ...\`; return fn(tx); })`. With `prepare: false` set in `apps/api/src/db/db.module.ts:23`, none of these `SET LOCAL` calls is server-cached; each is parsed, planned, and round-tripped. Postgres-js measures `BEGIN` + 3×`SET LOCAL` + `COMMIT` at ~2-3 ms locally, ~6-10 ms across an AZ — enough to consume 5-10 % of the p95 < 200 ms budget on every request before any business logic runs.
- Recommendation: (a) Collapse to a single statement: `SELECT set_config('app.current_firm_id', $1, true), set_config('app.current_auditor_id', $2, true), set_config('app.current_engagement_id', COALESCE($3,'00000000-0000-0000-0000-000000000000'), true)`. (b) Re-enable prepared statements (drop `prepare: false`) once PgBouncer is in transaction mode (PgBouncer in transaction mode is incompatible with prepared statements; either run PgBouncer in session mode at the cost of pool efficiency, or use postgres-js' `prepare: false` only on PgBouncer-connected pools and `prepare: true` directly to Postgres). (c) For read-only requests that don't need a transaction, drop the BEGIN/COMMIT entirely and rely on a per-request connection pinned with `set_config(..., FALSE)` for the duration of the request — `withTenant` always wraps even simple reads, doubling round-trip count.

### HIGH #3 — No PgBouncer / RDS Proxy mention in helm chart; pool sizing × replicas exceeds Postgres `max_connections`

- File: `infra/helm/auditforge/templates/postgres-statefulset.yaml`, `infra/helm/auditforge/values-prod.yaml:7-20`, `apps/api/src/config/config.schema.ts:11` (`DATABASE_POOL_MAX: 20`)
- Issue: Production overlay sets API `maxReplicas: 30` and worker `maxReplicas: 50`, each with `DATABASE_POOL_MAX: 20`. That is a worst-case `(30+50) × 20 = 1600` direct connections to RDS; standard RDS Postgres `max_connections` is 1000-1500 depending on instance class. PgBouncer (or RDS Proxy) is mentioned only in `docs/architecture/threat-model.md`; nothing in `infra/helm/auditforge/templates/` deploys it. With `prepare: false` already set in the api (per High #2), PgBouncer transaction mode would be drop-in.
- Recommendation: Add a `pgbouncer` deployment template behind a `ClusterIP` service, set the api `DATABASE_URL` to point at it, and reduce `DATABASE_POOL_MAX` to e.g. 5 per pod. Document the RDS Proxy alternative in `infra/helm/auditforge/values-prod.yaml`.

### HIGH #4 — No materialised `MaterialisedDoc` cache for Yjs sync; every offline-roundtrip rebuilds full doc

- File: `packages/working-papers/src/sync.ts:50-66`, `packages/working-papers/src/crdt.ts:55-77`
- Issue: `applyOfflineRoundtrip` constructs a fresh `Y.Doc`, applies the full server snapshot (`Y.applyUpdateV2`), computes a delta (`Y.encodeStateAsUpdateV2`), applies the client update, then re-encodes the entire snapshot. There is no cache of the live `Y.Doc` per working-paper across requests. With `Y.encodeStateAsUpdateV2` cost roughly proportional to the doc's history size, this scales linearly with editing volume per WP. There is no eviction policy and no LRU.
- Recommendation: (a) Add a process-local LRU of materialised `Y.Doc` instances keyed by working-paper id, evicting after e.g. 10 minutes of idleness or when total memory > N MB. (b) Coordinate across replicas via a `wp:{id}:rev` Redis key so a replica that misses the LRU rebuilds from the latest snapshot. (c) Periodically compact: `Y.encodeStateAsUpdateV2(doc)` and reseed with a fresh `Y.Doc` to truncate history. (d) For peer-to-peer sync, integrate `y-redis` or `hocuspocus` as the persistence layer rather than rolling your own.

### HIGH #5 — `ContradictionDetector.detect` always loads all engagement claims

- File: `packages/audit-memory/src/services/contradiction-detector.ts:18-53`
- Issue: `listClaims(ctx)` then linear scan, then `claims.find(...)` per relation edge (line 42) — O(N + N × E) per call. The schema already has `audit_memory_claims_subj_pred_ix` on `(engagement_id, subject, predicate)` (`packages/audit-memory/src/db/schema.ts:239-243`) but it is never used because the query never reaches SQL.
- Recommendation: Move to SQL: `SELECT * FROM audit_memory_claims WHERE engagement_id = $1 AND subject = $2 AND predicate = $3 AND object <> $4 AND validity = 'active' AND ($5::uuid IS NULL OR id <> $5)`. Replace `claims.find` with a `WHERE id = ANY($otherIds::uuid[])` lookup.

### HIGH #6 — `httpRequests` and `ledgerEvents` Prometheus counters carry per-firm label (high cardinality)

- File: `apps/api/src/common/metrics.ts:7-27`
- Issue: Both `auditforge_http_requests_total` and `auditforge_ledger_events_total` declare a `firm` label. With even a few hundred tenants, label cardinality blows up Prometheus storage (each unique label combo = a distinct time series; per-status × per-route × per-method × per-firm easily hits 10⁵ series for a busy install) and slows scrape.
- Recommendation: (a) Drop the `firm` label from these counters; rely on log-based aggregation for tenant-scoped counts. (b) Add a separate, low-cardinality `auditforge_http_requests_per_firm_total` with bucketing (top-K firms only) if per-tenant rates are needed for billing. (c) Consider a histogram with `route` only and use exemplars for trace correlation rather than firm label.

### HIGH #7 — OTel SDK exports traces only; no metrics, no logs, no sampling

- File: `apps/api/src/otel.ts:1-21`
- Issue: `NodeSDK` is initialised with only an `OTLPTraceExporter`. There is no `MeterProvider`, no `LogRecordProvider`, and no sampler is set so the default `ParentBased(AlwaysOn)` is in effect. For the 200-rps `probes-200` scenario (`tests/load/scenarios/probes-200.js`) every request will export a span — enough to saturate the OTLP collector and create back-pressure on the HTTP server.
- Recommendation: (a) Add a head-based parent-or-trace-id-ratio sampler (default e.g. 0.05 in production, 1.0 in dev) configurable via `OTEL_TRACES_SAMPLER_ARG`. (b) Add an `OTLPMetricExporter` so the Prometheus rules in `infra/helm/auditforge/templates/prometheusrule.yaml` can actually fire. (c) Gate `auto-instrumentations-node` to the modules you use — the default set instruments dns, http, fs, etc. and adds 5-15 % CPU.

### HIGH #8 — `apps/worker/src/processors` is empty; `WORKER_CONCURRENCY` and `WORKER_TENANT_CONCURRENCY` are configured but never used

- File: `apps/worker/src/processors/` (empty), `apps/worker/src/config/config.ts:21-22`, `apps/worker/src/adapters/` (empty)
- Issue: Per-tenant fairness, DLQ behavior, retry semantics, queue scheduling — none of it is implemented. The api enqueues to bullmq queues defined in `apps/api/src/queue/queue.module.ts:10-21` but nothing consumes them. The Helm chart sets up `worker-deployment.yaml` and `worker-hpa.yaml` (with custom metric `probe_queue_depth`) but the queue depth metric is never emitted and the worker has no main-loop.
- Recommendation: (a) Build per-queue `bullmq` Workers; respect `WORKER_TENANT_CONCURRENCY` via bullmq's per-job rate limiting (group key = firmId) or via Redis token bucket. (b) Emit `probe_queue_depth` (and `*_queue_depth` for every queue) from `apps/api`'s queue module on a scheduled interval; HPA `customMetrics` already references it. (c) Implement a real DLQ: failed jobs after `attempts: 5` (set in queue.module.ts:32) are moved by bullmq automatically but no observer logs them or re-tries them; add a DLQ inspector endpoint and a metric `auditforge_dlq_size{queue}` per queue.

### HIGH #9 — `SandboxPolicy.withWallclock` does not actually kill the probe; orphan tasks keep consuming CPU/memory

- File: `apps/worker/src/sandbox/policy.ts:52-65`, `packages/probe-engine/src/sandbox.ts:117-167`
- Issue: Both `withWallclock` (worker) and `ProcessSandbox.execute` (probe-engine) use `Promise.race([fn(), timeout])` — when `timeout` wins, `fn()` is *not* terminated, just unawaited. The probe continues running in the same Node event loop until its async work finishes, holding memory and stealing CPU from new probes. The class JSDoc on `ProcessSandbox` (line 115) acknowledges "DOES NOT provide isolation" but the comment on line 4 of `apps/worker/src/sandbox/policy.ts` says "Production enforcement is container-level (network namespace + egress proxy)" — yet there is no code in `apps/worker` that spawns a new container/process per probe; the worker just runs the `runFn` inline.
- Recommendation: (a) Run probes in `worker_threads` with `worker.terminate()` on timeout; that gives real isolation. (b) Or `child_process.spawn()` a probe runner with `signal: AbortSignal` and `timeout` that uses `SIGKILL`. (c) The egress allowlist enforcement (`AllowlistSandboxPolicy.isHostAllowed`) is fine, but it must be paired with an outbound egress proxy in the network namespace; see `infra/helm/auditforge/templates/networkpolicy.yaml`.

### HIGH #10 — `AuditTrailInterceptor` is fire-and-forget over an in-memory ledger; durable write path missing

- File: `apps/api/src/common/audit-trail.interceptor.ts:44-56`
- Issue: `void this.ledger.append(...).catch(err => this.logger.error(...))` — if the append throws, only a log line records the loss. Combined with Blocker #3, this means every business mutation has at-most-once-best-effort audit logging. For 99.999 % durability the audit must be on the write path with the same transaction.
- Recommendation: Move to outbox pattern (`emit_pending` table written transactionally with the business write; a relay job moves to ledger and marks consumed). Until that lands, surface the failure with a 5xx so callers don't believe the action succeeded silently.

### HIGH #11 — Catalogue loaders parse JSON + Zod-validate on every call; no caching

- File: `packages/catalogues/src/loader.ts:32-182`
- Issue: `loadIso42001Clauses`, `loadAnnexAControls`, `loadEuAiActArticles`, `loadNistAiRmfSubcategories`, `loadOwaspLlmTop10`, `loadMitreAtlasTechniques`, `loadAvidCategories`, `loadMitAiRiskCategories`, `loadFrameworkMappings` — each does `readFile(...)`, `JSON.parse(...)`, full Zod parse on each invocation. The combined catalogue (`loadAllCatalogues`) parallelises but still re-reads on every call. These files don't change at runtime.
- Recommendation: Memoise: `let cached: AllCatalogues | null = null; export async function loadAllCatalogues() { return cached ??= await load(); }`. For multi-replica freshness, version-stamp by file mtime + bake into the build. For Redis-shared cache across replicas, push a parsed JSON blob into a per-deployment key.

### HIGH #12 — In-memory search indexer re-tokenises every doc on every query

- File: `packages/working-papers/src/search.ts:108-172`
- Issue: `InMemorySearchIndexer.query` iterates every doc in `this.docs`, calls `tokenize(doc.text)` and constructs a `Set` from it on every call (lines 149-150). At 100 docs per engagement times 100 concurrent queries, this is 10k tokenisations/s. There is no inverted index. The note "production swap for Meilisearch + pgvector" is fine but no production adapter exists in the repo.
- Recommendation: (a) Build a real `MeilisearchIndexer` adapter under `apps/api/src/adapters` and wire it via `WorkingPaperRegistry.search`. (b) For pgvector, persist embeddings on the WP row and add an HNSW index (`vector_cosine_ops`). (c) Until then, at minimum store pre-tokenised inverted index inside `InMemorySearchIndexer` so query-time work is O(unique-query-terms × posting-list).

### HIGH #13 — Frontend animations don't respect `prefers-reduced-motion` for framer-motion

- File: `apps/web/components/workspace/CandidateFindingCard.tsx:114-128`, `apps/web/app/globals.css:19-21`
- Issue: The CSS rule sets `animation-duration: 0.01ms !important` on `prefers-reduced-motion: reduce`, but framer-motion drives transforms via JS state, not CSS animations — so `motion.article` still runs the full `initial → animate` transition. The component comment claims "Respects prefers-reduced-motion via Tailwind motion-safe utility variants" (lines 19-20), but no `motion-safe:` or `motion-reduce:` classes appear anywhere; `useReducedMotion()` from framer-motion is not imported.
- Recommendation: Wrap the framer-motion usage with `useReducedMotion()`: when true, set `initial={false}` and `transition={{ duration: 0 }}`. Apply project-wide via a `<MotionConfig reducedMotion="user">` at `apps/web/app/layout.tsx`.

---

### MEDIUM #1 — Three `SET LOCAL` queries can be one `set_config()` call

- File: `apps/api/src/adapters/tenancy.adapter.ts:22-28`
- Recommendation: `SELECT set_config('app.current_firm_id', $1, true), set_config('app.current_auditor_id', $2, true), set_config('app.current_engagement_id', COALESCE($3, ''), true)` — single round-trip.

### MEDIUM #2 — `percentile()` uses `Math.min(...arr)` and `Math.max(...arr)` which can overflow argument list at 100k spans

- File: `packages/trace-analyzer/src/util/percentiles.ts:16-17`
- Issue: `Math.min(...values)` spreads array; Node's argument cap is around 65 535 on V8. At 100k spans this throws `RangeError: Maximum call stack size exceeded`.
- Recommendation: Replace with single-pass loop. The JSDoc at lines 23 also calls the function "single pass" but it sorts (which is O(N log N)); document accurately.

### MEDIUM #3 — `summarisePercentiles` allocates a sorted copy of every percentile request

- File: `packages/trace-analyzer/src/util/percentiles.ts:34`
- Recommendation: For 100k span latency arrays, sorting is still acceptable (~5-15 ms), but consider HDR Histogram or CKMS streaming quantiles for the trace ingest path so the analyzer can run in O(N) per ingest and produce p50/p90/p95/p99/max in one pass.

### MEDIUM #4 — `TraceAnalyzer.detectAnomalies` and `buildTimeline` allocate full copies + sort

- File: `packages/trace-analyzer/src/services/TraceAnalyzer.ts:51-69, 117-133`
- Issue: At 100k spans, two extra full-array sorts on top of the Zod parse at line 195. CPU peaks during ingest under k6 will exceed the 10-s budget in `tests/load/scenarios/trace-100k.js` even if streaming parsing (Blocker #4) is fixed.
- Recommendation: Combine timeline build, latency, and anomaly detection into one pass; skip Zod validation of `timeline[]` in production (the entries are produced internally and don't need re-validation).

### MEDIUM #5 — k6 scenarios accept 401/404 as success in `check()` calls

- File: `tests/load/scenarios/wp-edit-100.js:26`, `tests/load/scenarios/file-uploads-50.js:17`, `tests/load/scenarios/probes-200.js:16`, `tests/load/scenarios/report-gen.js:15`, `tests/load/scenarios/trace-100k.js:20`, `tests/load/scenarios/soak-24h.js:17`
- Issue: Each scenario allows `r.status === 401` (and sometimes 404, 503) as success, so a misconfigured `AUTH_TOKEN` produces an all-401 run that *passes*. Only `http_req_duration` thresholds enforce SLO; the `check()` "rate" never gates anything. The `wp-edit-100` test PATCHes synthetic ids `wp-${VU}-${ITER}` that almost always 404 — so the test exercises the not-found path on `GET memory.get(id)` rather than the actual edit code.
- Recommendation: (a) Tighten `check()` to `r.status >= 200 && r.status < 300`; treat 401/404 as fail. (b) Add a `setup()` step to seed real working-paper ids and pass them via a shared array. (c) Add a `tags: { route: 'wp.update' }` to the request and a per-route threshold so the trend shows in Grafana.

### MEDIUM #6 — Soak test only hits `/health/live` (which doesn't exist)

- File: `tests/load/scenarios/soak-24h.js:16`
- Issue: The route is `GET /healthz` per `apps/api/src/modules/health/health.controller.ts:20`. The scenario hits `/health/live` which returns 404 — and the `check` accepts 503 as success, so 24 h of 404s passes. Soak doesn't exercise representative traffic so leaks in the Map-based repos won't show up.
- Recommendation: Replace with a multi-route synthetic mix that includes `/working-papers`, `/findings`, `/probes`, `/traces`. Run with realistic `Idempotency-Key` distribution to exercise the cache (currently leaking, see High #1). Reuse a shared array of seeded engagementIds.

### MEDIUM #7 — `EvidenceArtifactSchema.parse` re-stringifies inline evidence twice

- File: `packages/probe-engine/src/runner.ts:161-172`
- Issue: `JSON.stringify(e.inline)` is called once for `Buffer.byteLength` and again for `sha256`. For evidence blobs of even 100 KB this doubles CPU and allocates twice.
- Recommendation: Hoist the stringification: `const s = e.inline ? JSON.stringify(e.inline) : ''; bytes = Buffer.byteLength(s); sha256(s);`.

### MEDIUM #8 — No bundle analyzer / Lighthouse CI in `apps/web`

- File: `apps/web/package.json:1-44`
- Issue: No `@next/bundle-analyzer`, no Lighthouse-CI, no Chrome UX Report integration. Without these, the LCP < 2.5 s / CLS = 0 targets cannot be tracked over time. `framer-motion` (line 25) ships at ~50 KB minified-gzip — the `layout` prop on `motion.article` triggers FLIP measurements per render which can spike CLS in lists.
- Recommendation: Add `@next/bundle-analyzer` and a CI check that fails if the largest entry chunk exceeds 250 KB (gzipped). Add `@lhci/cli` running against a built static export per PR.

### MEDIUM #9 — `next/image` is not used; raw `<img>` would not be optimised

- File: `apps/web/components/`, `apps/web/app/` — Grep shows no `next/image` import.
- Recommendation: Use `next/image` for any logos, evidence thumbnails, and PDF-page previews to get automatic webp/avif transform, lazy loading, and width-aware srcsets. Critical for LCP under 2.5 s on mobile.

---

### INFO #1 — `prepare: false` on the Postgres client disables prepared-statement cache

- File: `apps/api/src/db/db.module.ts:23`
- Note: This is required for PgBouncer transaction mode (and for the planned `set_config()` collapse in Medium #1), but it disables postgres-js' per-statement caching. Once PgBouncer is wired (High #3), this stays false. If running directly to RDS, set `prepare: true` to amortise plan cost on hot queries.

### INFO #2 — `claim_attributions` lacks `(engagement_id, framework, node_id)` composite

- File: `packages/audit-memory/src/db/schema.ts:328-334`
- Note: Today indexes are `(claim_id)` and `(framework, node_id)`. Cross-engagement queries on `(framework, node_id)` will work but bypass tenant scoping at the index level. Add a composite to keep RLS-safe queries fast.

### INFO #3 — pgvector index uses `ivfflat` with default lists; consider HNSW

- File: `packages/audit-memory/src/db/schema.ts:250-251`
- Note: `ivfflat` requires `lists` tuned to N (rule of thumb: `sqrt(rows)`); not specified here so it defaults to 100, which under-performs at 100k+ vectors. HNSW (available in pgvector ≥ 0.5) gives consistent recall/latency without manual tuning at the cost of build time. Recommended.

### INFO #4 — `infra/observability/grafana-dashboards` and `otel-collector-config` are empty

- Note: Helm sets up `servicemonitor.yaml` and `prometheusrule.yaml` but no dashboards exist, so when alerts fire there is no panel to consult. Build the Grafana JSON exports as part of the repo.

### INFO #5 — `tests/load/lib` is empty

- Note: No shared utilities for k6 (auth helper, seed loader, latency tagger). Build out before scaling the scenario count.

---

## SLOs without instrumentation

The Helm `prometheusrule.yaml` references metrics that no source file emits. Each is a silent alert that will never fire:

| Metric (referenced in `infra/helm/auditforge/templates/prometheusrule.yaml`) | Emitted? | Required for SLO |
|---|---|---|
| `auditforge_ledger_chain_verify_failures_total` | No | ledger-integrity |
| `auditforge_av_scan_enabled` | No | evidence-integrity |
| `auditforge_rls_bypass_total` | No | tenant-isolation |
| `auditforge_probe_budget_used` | No | per-engagement budget |
| `auditforge_probe_budget_total` | No | per-engagement budget |
| `auditforge_llm_cost_usd_total` | No | LLM cost SLO |
| `auditforge_ledger_pending_events` | No | ledger throughput |
| `probe_queue_depth` (HPA custom metric) | No | worker autoscaling |
| `http_requests_total` (used in latency burn rate) | Partial — emitted as `auditforge_http_requests_total` | api-availability/latency |
| `http_server_duration_seconds_bucket` | No (we emit `auditforge_http_request_duration_ms`) | api-latency |

Action: either rename the metrics in code to match the `prometheusrule.yaml`, or rewrite the rule expressions to match the existing names. The current state means the burn-rate alerts at lines 19-54 of `prometheusrule.yaml` will silently match no series and stay quiet during a real outage.

Additional missing instrumentation for the explicit SLO targets:

- **p95 API latency < 200 ms (working-paper edit):** the `auditforge_http_request_duration_ms` histogram (`apps/api/src/common/metrics.ts:14-20`) is declared but not wired into a Fastify `onResponse` hook anywhere — never observed. Until that is fixed, neither the api SLO panel nor the burn-rate alert can compute a percentile.
- **audit-ledger durability 99.999 %:** no metric tracks ledger writes vs business-write attempts. Add `auditforge_ledger_emit_attempts_total{result}` and a counter for outbox lag (see Blocker #3).
- **signing pipeline 99.9 %:** no metric counts sign attempts/failures. Add `auditforge_report_sign_total{result}` keyed off the `signed-action.interceptor` and the report-engine signer.
- **probe-runner availability 99 %:** no probe-execution success ratio metric. Add `auditforge_probe_execution_total{verdict, mode}` from `packages/probe-engine/src/runner.ts:198-216`.

---

## Priority-ordered remediation roadmap

1. Wire Postgres-backed repositories (Blocker #2). Without this nothing else can be measured against real workload.
2. Replace `InMemoryEventRepository` with Postgres + outbox (Blocker #3). Required for ledger durability.
3. Fix the OTel importer streaming (Blocker #4). Required for trace-100k SLO.
4. Push bi-temporal AS-OF query into SQL (Blocker #1). Required for audit-memory perf.
5. Hoist + index the BFS in `ClaimGraph.traverse` (Blocker #5).
6. Switch the budget controller to Redis Lua (Blocker #6). Required for cost safety in HA.
7. Move idempotency cache to Redis (High #1) and emit the SLO-critical metrics (SLO instrumentation gap above).
8. Add PgBouncer to helm (High #3) and collapse RLS context to one `set_config()` call (High #2 / Medium #1).
9. Implement worker processors + DLQ + queue-depth metric (High #8).
10. Real probe sandbox via `worker_threads` (High #9).
11. Materialised Yjs doc cache (High #4).
12. Tighten k6 thresholds and seed real ids (Medium #5, Medium #6).
13. Frontend: framer-motion reduced-motion, bundle analyzer, `next/image` (High #13, Medium #8, Medium #9).

Until step 1 lands, k6 numbers do not predict production behaviour. After steps 1-3, re-run the scenarios with realistic seed data to establish a real baseline.
