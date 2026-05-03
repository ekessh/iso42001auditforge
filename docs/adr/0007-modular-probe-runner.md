# ADR-0007: Modular Probe Runner With Sandboxed Workers and Egress Allowlist

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0, 5
- **Tags**: probes, sandbox, security

## Context

Probes execute auditor-defined or library-shipped logic that may call out to auditee inference endpoints, MLflow servers, vector DBs, or run model code locally. A bad probe can leak data, blow the budget, or escape into the host network.

## Decision

Each probe is declared via a typed schema (`probe-engine` package). The runner executes probes in a worker pool with:

- a per-execution network policy (egress allowlist of auditee endpoints + AuditForge services + explicitly approved third parties),
- a CPU + memory cap and a wall-clock cap,
- per-engagement budget tracking (cost ceiling for live probes; running total visible to the lead auditor),
- result schema validation before persistence,
- full audit-ledger event for every execution (params, raw response, derived verdict, who, when).

Probes run in three modes: **offline** (auditor test set against a snapshot), **live** (queries an auditee endpoint with consent), **replay** (analyses provided traces).

Local-LLM probe evaluation is the default for AI-driven probes (ADR-0005).

## Consequences

### Positive
- Sandbox failure is bounded to a worker, not the API.
- Budget runaway impossible without explicit confirmation.
- Probe authoring is structured and auditable.

### Negative
- Each new probe needs ground-truth fixtures.
- Network policy enforcement requires container-level controls in production.

### Neutral
- Library probes ship under BUSL-1.1 (per repo license). Premium adversarial suites may ship later.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Inline probe execution in API | Sandbox + isolation impossible. |
| Generic "shell out to user code" | Auditor doesn't trust black-box plugins. |
| Cloud LLM judge for every probe | Privacy + cost. |

## Compliance Implications

ISO 42001 A.6.2 (lifecycle), A.7 (data), A.9 (use), and incident responsibilities under A.5.

## Follow-Ups

- [ ] Define the probe DSL.
- [ ] Implement budget enforcement.
- [ ] Provide ground-truth fixture format.
