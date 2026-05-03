# @auditforge/sampling

Sampling planner for AuditForge ISO 42001 lead-auditor workbench. Implements
Section 3.10 / Phase 10 (`auditforge.md`).

License: BUSL-1.1.

## Scope

Pure-domain library. No transports, no persistence. Consumers (`apps/api`,
`apps/worker`) wire population data, persist plans, and emit ledger events.

## Domain

- `SamplePopulation` — `use_cases | models | agents | datasets | incidents | transactions`
- `SamplingMethod` — `random | judgmental | stratified | risk_based`
- `SamplePlan` — population, method, size, rationale, seed (deterministic)
- `SampleUnit` — selected unit, stratum, weight, rationale (judgmental only)

## Services

| Service | Responsibility |
|---|---|
| `SampleSizeCalculator` | `n = ceil(sqrt(N))` default; per-scheme overrides; risk-weighted overlay; min/max bounds |
| `RandomSampler` | Cryptographically seeded reservoir sampling (reproducible) |
| `StratifiedSampler` | Proportional allocation per declared stratum |
| `JudgmentalSamplingHelper` | Auditor-curated; rationale capture per unit |
| `RiskBasedSampler` | Weighted-without-replacement sampling using risk scores from `@auditforge/risks` (port-injected) |
| `DistributionAuditor` | Chi-square goodness-of-fit + KS-style monotone check vs declared distribution |

## Reproducibility

All randomness flows through a deterministic `SeededRng` (xoshiro128**) seeded
from `SHA-256(seed-string)`. Replaying a `SamplePlan` with its `seed` always
yields the identical `SampleUnit[]`.

## Sampling rule count

Eight built-in scheme rules ship in `services/rules.ts`:

- `default-sqrt` — `ceil(sqrt(N))` clamped `[3, 30]`
- `iso17021-low-complexity` — `max(3, ceil(sqrt(N) * 0.8))`
- `iso17021-medium-complexity` — `ceil(sqrt(N))`
- `iso17021-high-complexity` — `ceil(sqrt(N) * 1.25)`
- `mdr-iaf-md23-aims-low` — `max(5, ceil(sqrt(N)))`
- `mdr-iaf-md23-aims-high` — `max(8, ceil(sqrt(N) * 1.5))`
- `incident-population` — `min(N, max(5, ceil(sqrt(N) * 1.5)))` (incidents always over-sampled)
- `risk-weighted-overlay` — multiplier `1 + (avgRiskScore/100) * 0.5`

Additional schemes can be registered through `SchemeRegistry.register(rule)`.

## Tests

35+ vitest cases: chi-square goodness-of-fit on synthetic populations,
seeded reproducibility, edge cases (`N=0`, `N=1`, `N=10_000`), and
property-based (`fast-check`) invariants for size calculator monotonicity
and stratified allocation summing to `n`.
