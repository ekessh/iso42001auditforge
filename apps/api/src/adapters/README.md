# API Adapters

Each adapter file in this directory wires a `@auditforge/*` workspace
package into the NestJS API. Adapters are the **only** sanctioned bridge
from the API layer to a workspace package — modules must NOT reach into
package internals directly.

## Wiring Pattern

Every adapter follows the same shape:

```ts
@Injectable()
export class XxxAdapter {
  // Workspace-package services / stores instantiated here.
  readonly service: PackageService;
  // API-side `TenantScopedRegistry` for legacy DTO surfaces.
  readonly registry: TenantScopedRegistry<...>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    // Build a ledger emitter that bridges into the audit-engine adapter.
    const ledger = makeLedger(audit);
    this.service = new PackageService(ledger, ...);
    this.registry = new TenantScopedRegistry(...);
  }
}
```

The shared `_tenant-registry.ts` provides the in-memory + ledger-emitting
CRUD envelope every module's repository delegates to.

## Phase-2 wiring

Adapter wired in this pass:

| Adapter                  | Package                            | Notes |
|--------------------------|------------------------------------|-------|
| `EngagementAdapter`      | `@auditforge/engagement`           | mode-immutability + workflows + programme calculator + plan builder |
| `CapaAdapter`            | `@auditforge/capa`                 | CAPA workflow + state machine + SLA tracker |
| `ArchiveAdapter`         | `@auditforge/archive`              | Merkle freeze + integrity + retention + accreditation portal + LTV |
| `SoaAdapter`             | `@auditforge/soa`                  | reviewer state machine + completeness + importers |
| `SamplingAdapter`        | `@auditforge/sampling`             | size calculator + 4 samplers + distribution auditor |
| `CoAuditorAdapter`       | `@auditforge/co-auditor`           | LlmBackendRouter + CoAuditorService + invocation ledger |
| `CrossFrameworkAdapter`  | `@auditforge/cross-framework`      | MappingRegistry + coverage calculator |
| `RisksAdapter`           | `@auditforge/risks`                | importers + cross-checks + impact assessment |
| `TraceAnalyzerAdapter`   | `@auditforge/trace-analyzer`       | shared by `traces` + `agent-workflows` modules |
| `AiSystemsAdapter`       | `@auditforge/ai-system-profiler`   | registry + profiler + risk classifier (services barrel pending) |
| `AuditPlansAdapter`      | `@auditforge/engagement` (plan)    | builder + conflict detector + receipt state machine |
| `InterviewsAdapter`      | `@auditforge/interviews`           | question library types only (services pending) |
| `BillingAdapter`         | `@auditforge/billing`              | rollup + tax + FX + productivity helpers |
| `PeerReviewAdapter`      | `@auditforge/peer-review`          | workflow + checklist registry + scoring + invariants |
| `SurveillanceAdapter`    | `@auditforge/surveillance`         | telemetry ingest + threshold + risk re-score + scope adjuster |

## Unwireable bits (TODOs)

These are documented inline as `TODO(integration): <reason>` comments. The
exhaustive list:

### Persistence (every adapter)

- **In-memory `TenantScopedRegistry`** — until `packages/db` exposes the
  per-module Drizzle schemas, every adapter persists CRUD rows in a
  process-local `Map`. The registry's interface is identical to the
  Drizzle-backed implementation that will replace it; the swap is
  contained to the adapter constructor.
- **`@auditforge/audit-engine`** uses an `InMemoryEventRepository`
  (already TODO'd in `audit-engine.adapter.ts`).

### Adapter-specific TODOs

- **`engagement.adapter.ts`** — the API status enum
  (`planned/in_progress/reporting/reviewed/issued/archived/cancelled`)
  diverges from the package's nine-state enum. The adapter keeps the
  legacy enum and emits a generic `engagement.status_changed` ledger event;
  the package's `EngagementService.transitionStatus` is reserved for callers
  speaking the package vocabulary.
- **`capa.adapter.ts`** — the API DTO surface (`name + metadata`) is too
  thin to drive the full `CapaWorkflow` (which requires `findingId`,
  `plannedActions`, `targetCloseDate`). The workflow is exposed via the
  adapter for callers that have richer payloads (typically the findings
  module promoting to CAPA). Once the API DTO grows, the registry's
  `create` hook will invoke `CapaWorkflow.propose` automatically.
- **`archive.adapter.ts`**:
  - `SignerProvider` defaults to a placeholder. Wire to the WebAuthn
    signing flow owned by `apps/api/src/modules/identity` once it exposes
    a server-side "request signature" surface.
  - `SnapshotProvider` defaults to an empty bundle. Wire to bundle exports
    from `working-papers`, `findings`, `evidence-vault`, `audit-ledger`
    once those modules expose stable export contracts.
  - LTV renewal cron job — exposed via `renewLtv()`; callers schedule via
    BullMQ.
- **`soa.adapter.ts`** — `checkCompleteness` requires the Annex A control
  catalogue from `@auditforge/catalogues`. Pass-through is exposed; the
  service layer wires the catalogue once that runtime API stabilises.
- **`co-auditor.adapter.ts`**:
  - `LlmBackend` defaults to an `EchoLlmBackend` (deterministic empty
    JSON output). Swap for `@auditforge/llm-provider`'s Ollama / vLLM /
    llama.cpp providers via `setLocalBackend` / `setCloudBackend`.
  - `ConsentLookup` defaults to permissive. Wire to a Postgres-backed
    consent table so cloud routing requires written engagement consent.
- **`cross-framework.adapter.ts`** — `initial-mappings.json` not yet
  loaded at boot. Caller seeds via `addMapping(firmId, mapping)`.
- **`ai-systems.adapter.ts`** — the package's
  `exports['./services']` map points to a `services/index.ts` that does
  not exist yet. The adapter exposes setter-based hooks for callers to
  plug in concrete services until that barrel ships.
- **`interviews.adapter.ts`** — the package's main barrel only re-exports
  `domain/question`. Session, scheduling, and action-item state machines
  land in a later phase.
- **`surveillance.adapter.ts`** — `StreamRegistry`, `NonceStore`, and
  `DedupStore` are in-memory. Production must persist all three (the
  nonce store especially, for replay-window guarantees across restarts).
  Secret resolver defaults to a stub; wire to a Vault-backed resolver.
- **`peer-review.adapter.ts`** — `ChecklistRegistry` starts empty; the
  host seeds versioned checklists at boot.

## Tests

- `_tenant-registry.spec.ts` — covers create / list (cursor pagination) /
  update / remove / tenant isolation.
- `engagement.adapter.spec.ts` — covers create / mode-immutability /
  programme + plan exposure / tenant guard.
- `capa.adapter.spec.ts` — covers create / state-machine surface / tenant
  guard.
- `auth-core.adapter.spec.ts` — pre-existing parity tests for auth.

Adapters that are pure pass-throughs (`risks`, `interviews`, `billing`,
`audit-plans`, `cross-framework`, `surveillance`) rely on the shared
`_tenant-registry.spec.ts` for the registry-side contract; their
package-side surface is already covered by the package's own test suite.

## Eliminated stubs

After this pass, **zero** modules in `apps/api/src/modules/` carry a
private `Map<string, …>` repository stub. Every CRUD path flows through
the adapter's `TenantScopedRegistry` (which emits hash-chained ledger
events for every mutation) and every richer operation flows through the
package's domain services.
