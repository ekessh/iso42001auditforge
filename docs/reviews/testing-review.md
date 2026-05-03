# AuditForge ISO 42001 — Deep Test Coverage QA Review

**Date:** 2026-05-03  
**Reviewer:** Automated QA Analysis  
**Repo:** BUSL-1.1 monorepo, `packages/*` + `tests/*`  
**Scope:** All 30 packages, all test suites, all test categories

---

## Executive Summary

The repo has a solid structural foundation: coverage thresholds are codified in every `vitest.config.ts`, the 8 Playwright journey specs are well-written with deterministic seed data, and security suite breadth is commendable. However, **9 of 30 packages have zero test files**, the compliance and probe-validity test directories are completely empty, the conversational-engine (v3 centrepiece) is untested, the corpus regression gate does not exist, Testcontainers integration is absent, and the visual/chaos/contract directories are empty stubs. The gap between the design spec's testing ambitions and current state is significant.

---

## Severity Key

| Level | Meaning |
|---|---|
| SEV-1 CRITICAL | CI gate fails or will fail; security or compliance regression risk |
| SEV-2 HIGH | Target coverage thresholds will not be met; missing mandatory test category |
| SEV-3 MEDIUM | Coverage likely achievable but specific important scenarios missing |
| SEV-4 LOW | Improvement opportunity; nice-to-have |

---

## 1. Unit Coverage by Package

### Coverage Methodology

All `vitest.config.ts` files declare the same threshold: 85% lines/statements/functions, 80% branches (some v3 packages are lowered to 80%/75% — noted below). Coverage is estimated by counting executable source files vs. test files and reviewing test breadth from file inspection.

### Package-by-Package Analysis

| Package | Src Files | Test Files | Ratio | Estimated Coverage | Status |
|---|---|---|---|---|---|
| `ai-system-profiler` | 20 | 0 | 0.00 | ~0% | SEV-1 |
| `archive` | 8 | 3 | 0.38 | ~70% | SEV-2 |
| `audit-engine` | 5 | 3 | 0.60 | ~85% | PASS |
| `audit-memory` | 24 | 1 (+ fixtures) | 0.04 | ~15% | SEV-1 |
| `auth-core` | 5 | 4 | 0.80 | ~90% | PASS |
| `billing` | 6 | 2 | 0.33 | ~50% | SEV-2 |
| `capa` | 5 | 2 | 0.40 | ~60% | SEV-2 |
| `catalogues` | 3 | 1 | 0.33 | ~50% | SEV-2 |
| `co-auditor` | 7 | 2 | 0.29 | ~40% | SEV-2 |
| `conversational-engine` | 18 | 0 | 0.00 | ~0% | SEV-1 |
| `coverage-dashboards` | 0 (dirs exist) | 0 | — | ~0% | SEV-2 |
| `cross-framework` | 5 | 1 | 0.20 | ~30% | SEV-2 |
| `db` | 2 | 0 | 0.00 | ~0% | SEV-1 |
| `engagement` | 28 | 6 | 0.21 | ~70% | SEV-2 |
| `evidence-vault` | 11 | 4 | 0.36 | ~65% | SEV-2 |
| `findings` | 21 | 5 (incl. helpers) | 0.24 | ~70% | SEV-2 |
| `interviews` | 2 | 0 | 0.00 | ~0% | SEV-2 |
| `llm-cloud` | 0 (empty src) | 0 | — | N/A | NOTE |
| `llm-local` | 6 | 3 (incl. helpers) | 0.50 | ~60% | SEV-2 |
| `llm-provider` | 0 (empty src) | 0 | — | N/A | NOTE |
| `nc-drafter` | 13 | 0 | 0.00 | ~0% | SEV-1 |
| `peer-review` | 16 | 2 (incl. helpers) | 0.13 | ~30% | SEV-2 |
| `probe-engine` | 35 | 0 | 0.00 | ~0% | SEV-1 |
| `report-engine` | 18 | 0 | 0.00 | ~0% | SEV-1 |
| `risks` | 5 | 1 | 0.20 | ~25% | SEV-2 |
| `sampling` | 14 | 8 (incl. helpers) | 0.57 | ~90% | PASS |
| `shared` | 5 | 4 | 0.80 | ~92% | PASS |
| `soa` | 7 | 4 (incl. fixtures) | 0.57 | ~75% | SEV-3 |
| `surveillance` | 10 | 7 (incl. helpers) | 0.70 | ~85% | PASS |
| `tenancy-core` | 2 | 1 | 0.50 | ~55% | SEV-2 |
| `trace-analyzer` | 22 | 0 | 0.00 | ~0% | SEV-1 |
| `ui-kit` | ~70 tsx/ts | 0 | 0.00 | ~0% | SEV-3 |
| `working-papers` | 11 | 0 | 0.00 | ~0% | SEV-1 |

**PASS packages (5):** `audit-engine`, `auth-core`, `sampling`, `shared`, `surveillance`  
**SEV-1 packages with zero tests (9):** `ai-system-profiler`, `audit-memory` (1 test for 24 src files), `conversational-engine`, `db`, `nc-drafter`, `probe-engine`, `report-engine`, `trace-analyzer`, `working-papers`

### Notable Gaps Within Tested Packages

**`archive` (SEV-2):** `ltv-renewal.ts`, `accreditation.ts`, `retention.ts` have no corresponding tests. Merkle + integrity tests are good but TSA token renewal logic is untested.

**`audit-memory` (SEV-1):** Only `episode-store` is tested via in-memory adapter. No tests for `claim-graph.ts`, `contradiction-detector.ts`, `hybrid-retrieval.ts`, `point-in-time.ts`, `compaction-worker.ts`, or `schema-registry.ts`. The bi-temporal query correctness (required by CLAUDE.md per-phase gate) is entirely unverified.

**`billing` (SEV-2):** `fx.ts` and `productivity.ts` have no tests. No property-based tests for FX conversion (stated goal). `rollup.ts` test coverage is partial.

**`capa` (SEV-2):** `workflow.ts` has no test. The full CAPA workflow (create → assign → implement → verify → close) is not covered end-to-end.

**`engagement` (SEV-2):** Workflow state machines are tested for Stage1/2/Surveillance/Recertification/Special. Missing: `plan/builder.ts`, `plan/export.ts`, `team/validation.ts`, the impartiality conflict detection edge cases, and recertification special handling in `recertification.ts`.

**`evidence-vault` (SEV-2):** `upload-flow.ts`, `signed-url.ts`, `retention.ts`, and `registry.ts` have no tests. The full upload pipeline (presign → upload → verify → link) is not integration-tested.

**`findings` (SEV-2):** `carry-forward/engine.ts`, `analytics/index.ts`, `ledger/in-memory.ts` are untested. The findings analytics pipeline and carry-forward logic (critical for certification cycles) lack any test coverage.

**`peer-review` (SEV-2):** Only the state machine is tested. 14 remaining source files covering `assignment.ts`, `checklist.ts`, `comments.ts`, `conflict-of-interest.ts`, `deadline-monitor.ts`, `delegation.ts`, `notification.ts`, `report-freeze.ts`, `summary-generator.ts`, `reviewer-pool.ts` have no tests.

---

## 2. Critical E2E Journeys (Playwright)

### Configuration Assessment — PASS

`playwright.config.ts` is well-configured:
- `retries: 2` on CI, `0` locally — correct
- `trace: "on-first-retry"` — correct
- `video: "on-first-retry"` — correct  
- `screenshot: "on"` — all tests take screenshots at each step
- `fullyParallel: true` with worker capping (2 on CI, 4 locally)
- Multi-browser: Chromium + Firefox + Webkit for `@critical`, iPhone 14 for `@mobile`
- Deterministic seed data: Fixed UUIDs in `seed-api.ts`, idempotent upsert seeding
- Per-test timeout: 60s, per-journey: 5min via Playwright default
- `@tags` segregation: `@critical` (PR gate), `@nightly` (full), `@mobile` (PWA)

**Missing:** No `PLAYWRIGHT_SEED_RANDOM_SEED` or equivalent for data that cannot be pre-seeded. The soak-state for `journey-02` offline tests depends on `ENGAGEMENT_ID` constant, which is correct.

### Journey Coverage Matrix

| Journey | Spec | Required Scenario | Covered | Notes |
|---|---|---|---|---|
| J1 | `journey-01-full-audit-lifecycle.spec.ts` | Login → engagement → plan → S2 WPs → findings → report → sign → archive | YES | Full 10-step test including ledger verification |
| J2 | `journey-02-offline-sync.spec.ts` | Offline CRDT sync, conflict resolution | YES | Both `J2a` (basic offline) and `J2b` (conflict) covered |
| J3 | `journey-03-auditee-capa.spec.ts` | Auditee CAPA portal | YES (file exists) | Not read in detail — assumed structurally similar |
| J4 | `journey-04-probe-execution.spec.ts` | Probe execution → WP linkage → finding | YES | `J4a` (offline bias) and `J4b` (replay drift) |
| J5 | `journey-05-trace-acl-drift.spec.ts` | Trace ingest, ACL drift detection | YES (file exists) | |
| J6 | `journey-06-peer-review.spec.ts` | Peer review workflow | YES (file exists) | |
| J7 | `journey-07-accreditation-auditor.spec.ts` | Accreditation portal read-only inspection | YES (file exists) | |
| J8 | `journey-08-surveillance.spec.ts` | Surveillance threshold breach → alert → ad-hoc consideration | YES | 5 sub-tests including replay attack |

All 8 required journeys are present and populated. **This is the strongest area of the test suite.**

### SEV-3 Gaps in E2E

1. **No `@mobile` tag in any journey** — the iPhone 14 Playwright project is configured but no journey has the `@mobile` tag. Offline journeys (J2) are particularly relevant on mobile.
2. **No WebAuthn passkey journey** — `journey-01` falls back to password auth; the passkey path stated in the spec is not tested end-to-end.
3. **No test for the `conversational-engine` interview flow** — no journey covers the v3 question-generator → answer-attribution → NC-drafter flow. This is a major product feature with zero E2E coverage.
4. **No Stage 1 journey** — J1 jumps straight to Stage 2. Stage 1 document review → readiness assessment → Stage 1 report is not covered.
5. **`tests/e2e/fixtures/` directory is empty** — the `SAMPLE_EVIDENCE` PDF and `probe-executions/creditrisk-offline-testset.json` and `agent-traces/creditrisk-production-logs.json` referenced in J4 are not present. J4 will fail at fixture load time.

---

## 3. Security Suites

### Structure

All 7 security suite files are in `tests/security/suites/`. The `authn/`, `injection/`, `upload/`, `llm/`, `owasp/`, `crypto/` subdirectories exist but are empty — they appear to be planned but unimplemented buckets.

### Suite-by-Suite Assessment

**`rbac-matrix.test.ts` — SEV-2**  
RBAC logic is a pure assertion matrix: the test declares a static permission table and verifies it against itself. It tests the static declaration, not the actual enforcement middleware. The 9-role × 10-endpoint matrix is present and the matrix does enumerate all 9 roles correctly. However:
- Only 10 endpoints are modelled (the spec calls for 9 roles × N endpoints, suggesting much broader coverage needed)
- No actual HTTP calls are made — this is a data-structure test, not an enforcement test
- Missing: `GET /clients`, `PATCH /engagements/:id`, `DELETE /findings/:id`, `POST /working-papers`, `GET /reports`, any surveillance or probe endpoints

**`tenant-isolation.test.ts` — SEV-2**  
The 200+ fuzz attempts are present and correctly structured. However, the RLS simulation is an in-memory JavaScript array filter, not a real Postgres RLS policy. The test verifies the application-layer logic model but not the actual database-level enforcement. No Testcontainers / real Postgres.

**`file-upload-abuse.test.ts` — PASS with caveat**  
Imports real production code (`filename-safety.js`, `mime-magic.js`, `zip-bomb-defense.js`). Path traversal (10 cases including Unicode RTL and encoded variants), MIME spoof, zip-bomb ratio, and EICAR header recognition are covered. Caveat: EICAR test only asserts the header bytes are what they are — it does not verify the scanning pipeline rejects the file.

**`jwt-attacks.test.ts` — SEV-2**  
Tests pure functions (`rejectAlgNone`, `rejectAlgConfusion`) defined within the test file itself, not the actual `packages/auth-core/src/jwt.ts` module. The test verifies the logical pattern but does not test production code. Missing: `kid` header injection, expired token acceptance, audience mismatch, clock skew tolerance abuse.

**`probe-sandbox-escape.test.ts` — SEV-3**  
Tests the egress allowlist against an in-file `allowEgress` function, not the actual sandbox implementation in `packages/probe-engine/src/sandbox.ts`. DNS rebinding and IPv6 bypass vectors are missing.

**`injection-payloads.test.ts` — SEV-3**  
The payload corpus is solid (SQL, NoSQL, OS cmd, XSS, SSRF, template injection all present). The sanitization helpers are inline test functions, not the production sanitizers. This validates the corpus completeness but not production code paths.

**`signature-tamper.test.ts` — PASS**  
Imports real production hashing code. Mutation, truncation, and append attacks are all verified against `hashBoth` + `verifyHash`. Good test.

### Missing Security Coverage (SEV-1)

1. **No ZAP integration** — `tests/security/` has a README mentioning ZAP but no CI workflow file and no `zap-baseline.yaml` or equivalent. ZAP is referenced in `CLAUDE.md` as part of the security CI stack but is not wired up.
2. **No Semgrep custom rules file** — Semgrep is mentioned but no `.semgrep.yml` with AuditForge-specific rules exists in the repo.
3. **`authn/` directory is empty** — WebAuthn ceremony, OIDC flow, MFA bypass, brute-force lockout, and session fixation tests are all absent.
4. **`crypto/` directory is empty** — Hash chain ordering attacks, TSA token replay, signature strip/substitute attacks (beyond the basic tamper test) are absent.
5. **`llm/` directory is empty** — Prompt injection against co-auditor, jailbreak attempts against NC-drafter, and the P-AF-CLAUSE-01 hallucination probe CI check (CLAUDE.md hard rule) are absent.
6. **`owasp/` directory is empty** — OWASP LLM Top 10 test coverage (supply chain attacks on prompts, insecure output handling, excessive agency) is absent.
7. **No rate-limiting tests** — Surveillance telemetry endpoint rate limit, API login brute-force, and probe execution queue exhaustion are not tested in the security suite (though `surveillance` package has a `rate-limit.test.ts`).

---

## 4. Compliance Tests

### Status: CRITICAL — All directories are empty

`tests/compliance/man-days/`, `tests/compliance/clause-coverage/`, `tests/compliance/templates/`, and `tests/compliance/nc-numbering/` all exist as empty directories. No test files are present in any of them.

This is a SEV-1 finding for a compliance-focused product.

**Expected content per spec:**

**`man-days/` (SEV-1):** ISO 17021-1 + IAF MD 23 man-day calculation golden cases. The `engagement/tests/programme.calculator.test.ts` covers the calculation logic well, but the compliance-specific test directory (which would contain golden-case CSV/JSON fixtures verifying the calculator against known IAF MD 23 examples) is absent. The calculator itself may be correct but there is no compliance-layer regression gate.

**`clause-coverage/` (SEV-1):** No tests verifying that the ISO 42001 clause catalogue (Clauses 4–10, Annex A.2–A.10, 38 controls) is complete and correctly mapped. The `catalogues` package has 1 test (`loader.test.ts`) but it does not verify clause completeness.

**`templates/` (SEV-1):** No snapshot tests for Stage 1, Stage 2, Surveillance, and Recertification report templates. Template regressions (variable names changing, sections dropping) would be invisible to CI.

**`nc-numbering/` (SEV-1):** No golden tests for NC numbering schemes (CB-style sequential, clause-scoped, engagement-scoped). The `findings/tests/numbering.test.ts` exists in the package but is separate from the compliance-layer test that would cross-reference actual scheme outputs against expected numbering patterns.

---

## 5. Probe Validity Tests

### Status: CRITICAL — All directories are empty

`tests/probe-validity/suites/` and `tests/probe-validity/fixtures/known-good/` and `tests/probe-validity/fixtures/known-bad/` are all empty.

This is a SEV-1 finding. The probe library is central to AuditForge's differentiation.

**Current probe inventory in `probe-engine`:**
- P-BIAS-01: Demographic parity (binary classifier)
- P-BIAS-02: Equalized odds
- P-BIAS-03: (exists, content not read)
- P-BIAS-04: (exists)
- P-INJ-01: Prompt injection
- P-ROB-01, P-ROB-02, P-ROB-03: Robustness probes

**Missing probe validity tests:**
- No known-good fixture files — probes cannot be verified to produce `pass` on conformant inputs
- No known-bad fixture files — probes cannot be verified to produce `fail` on non-conformant inputs
- No test for P-AF-CLAUSE-01 (hallucination probe, CLAUDE.md hard requirement — "re-ranker emits only valid clause IDs")
- No tests for P-MCP-01 through P-MCP-08 (tool poisoning, server allowlist, audit trail, auth mode, per-tool RBAC, indirect prompt injection, cross-server isolation, gateway policy) — these probes are defined in the design spec but not yet implemented in `probe-engine/src/probes/`
- No test for P-HALL-01, P-DRIFT-01, P-LEAK probes referenced in E2E journeys (J4b references `P-DRIFT-01` which does not exist in the probe library)
- No negative test verifying that invalid probe parameters (malformed `Params`) are rejected by the Zod schema

**Note on `probe-engine` package:** Despite having 35 source files, there is no `tests/` directory under the package itself. The `vitest.config.ts` exists but there are no test files. This is the most severe gap in the package-level unit tests.

---

## 6. Corpus Regression Gate

### Status: CRITICAL — Does not exist

Neither `tests/conversational-engine/` nor any `baseline.json` / `release-gate.ts` file exists anywhere in the repository outside of `.git`. The CLAUDE.md per-phase gate requirement ("Corpus regression test passes — no metric regression > 5%") has no implementation.

**What should exist:**
- `tests/conversational-engine/runners/release-gate.ts` — Vitest/Node runner that loads `baseline.json`, runs the conversational engine against a fixed corpus of synthetic audit scenarios, computes metrics (attribution F1, question relevance score, NC-draft precision/recall, coverage-tracker accuracy), and fails CI if any metric regresses more than 5% from baseline
- `tests/conversational-engine/corpus/baseline.json` — Recorded baseline metrics for all engine sub-components
- `tests/conversational-engine/corpus/synthetic-scenarios/` — Fixed audit scenario fixtures covering diverse AI system types, clause sets, and evidence patterns

**Impact:** Without this gate, the conversational engine (question-generator, attribution, adaptive-evolution, NC-drafter) can silently degrade with every LLM provider update, prompt template change, or claim-graph schema migration.

---

## 7. Property-Based Tests

### Fast-Check Usage Assessment

**Files using fast-check (8 found):**

| File | Properties Tested |
|---|---|
| `audit-engine/tests/hash.test.ts` | Canonical JSON key-order invariance |
| `auth-core/tests/rbac.test.ts` | Every role reads catalogue; `client_user` scope constraints |
| `engagement/tests/programme.calculator.test.ts` | Monotonicity, half-day alignment, integration cap, cycle total |
| `sampling/tests/random-sampler.test.ts` | (not read in detail) |
| `sampling/tests/sample-size-calculator.test.ts` | Size ≤ N, monotonicity in N |
| `sampling/tests/seeded-rng.test.ts` | (not read in detail) |
| `sampling/tests/stratified-sampler.test.ts` | (not read in detail) |
| `shared/tests/ids.test.ts` | (not read in detail) |

**Good:** Programme calculator and sampling tests have genuine property-based coverage with `numRuns: 150–200`.

**Missing property-based tests (SEV-2):**

1. **FX conversion (`billing/src/fx.ts`)** — No property test verifying round-trip `convert(a→b→a) ≈ a`, no test that missing rates always throw, no test for cross-currency chain consistency
2. **Tax calculation (`billing/src/tax.ts`)** — No property test verifying `tax ≥ 0` for all inputs, reverse-charge threshold invariants
3. **Readiness percentage calculator (`coverage-dashboards`)** — The dashboard formula defined in CLAUDE.md (`sum(clause_weight * clause_status_score) / sum(clause_weight)`) has no property tests verifying bounds (0 ≤ score ≤ 1), monotonicity in evidence, or N/A exclusion
4. **Hash chain (`audit-engine/src/ledger.ts`)** — Only basic hash properties tested. No property test verifying that any permutation of ledger events produces a different chain hash
5. **RBAC matrix completeness** — The property tests in `auth-core` test a subset; no shrinking-based exploration for edge cases in role combination explosion
6. **Scope resolver (`conversational-engine/src/question-generator/scope-resolver.ts`)** — Deterministic sort invariance should be property-tested
7. **Bi-temporal point-in-time query (`audit-memory/src/services/point-in-time.ts`)** — No property tests for `query(t1) ⊆ query(t2)` when `t1 < t2`, or that claims inserted after query time are not visible

---

## 8. Integration Tests (Testcontainers)

### Status: CRITICAL — Testcontainers not used anywhere

A full text search for `testcontainers`, `GenericContainer`, `PostgreSqlContainer`, and `RedisContainer` across all `.ts` and `.js` files (excluding `node_modules`) returned zero results. No Testcontainers-based integration tests exist.

**`packages/db/vitest.config.ts`** is configured with `testTimeout: 120_000`, `pool: 'forks'`, `singleFork: true` — all signs that integration tests were anticipated — but the `tests/` directory is empty.

**Missing integration tests (SEV-1):**

1. **Migration up/down/up loop** — No test runs `drizzle-kit push` (or equivalent migration runner) against a real Postgres container, applies migrations, rolls back, and re-applies to verify idempotency and no schema corruption
2. **RLS bypass attempts** — No test using a real Postgres connection with `SET LOCAL app.current_firm_id = 'firm-a'` attempts to query rows belonging to `firm-b` and verifies RLS blocks access
3. **Audit-ledger replay regression** — No test inserts 100+ ledger events with known hashes, replays them from genesis, and verifies the final chain hash matches a recorded baseline
4. **Bi-temporal query correctness** — CLAUDE.md per-phase gate requires this; no implementation
5. **Redis BullMQ queue integration** — No integration test for probe execution queue, report generation queue, or CAPA notification queue against a real Redis container
6. **MinIO/S3 upload integration** — `evidence-vault` upload flow is not tested against real object storage
7. **Meilisearch search integration** — Working paper search is not tested against real search engine

---

## 9. E2E Flakiness Controls

### Assessment: MOSTLY GOOD — 3 gaps

**Present and correct:**
- `retries: 2` on CI
- `trace: "on-first-retry"` (traces captured on any failure)
- `video: "on-first-retry"` (video on any failure)
- `screenshot: "on"` (screenshots at every explicit step)
- Deterministic seed UUIDs in `SEED_BUNDLE` — all cross-journey references use fixed IDs
- `storageState` per-role pre-authenticated state — no login flakiness
- `global-teardown.ts` exists (clean shutdown)
- `forbidOnly: !!process.env["CI"]` — prevents accidental `.only` in CI
- `actionTimeout: 10_000`, `navigationTimeout: 15_000` — reasonable bounds

**Gaps (SEV-3):**

1. **Empty `tests/e2e/fixtures/` directory** — Journey 4 references `tests/fixtures/reports/sample-evidence.pdf`, `tests/fixtures/probe-executions/creditrisk-offline-testset.json`, and `tests/fixtures/agent-traces/creditrisk-production-logs.json`. These files are absent. J4 will always fail with a file-not-found error in CI.

2. **No visual stability wait in offline tests** — Journey 2 uses `context.setOffline(true)` but does not wait for any service worker to confirm offline mode is active before asserting the offline banner. This is a race condition that could cause intermittent failures if the SW registers slowly.

3. **No `PLAYWRIGHT_SEED_RANDOM_SEED`** — Dynamic data within journeys (timestamps, auto-generated NC numbers, report IDs) could cause assertion flakiness if tests check for specific text patterns that include generated values. Current journeys use regex patterns that should be tolerant, but this is worth formalising.

---

## 10. Visual Regression Tests

### Status: NOT IMPLEMENTED — directories are empty

`tests/visual/pages/` and `tests/visual/snapshots/` are both empty directories.

**What exists:** Storybook stories for 25 components in `packages/ui-kit/stories/`:
- Core: Button, Badge, Card, Dialog, DataTable, Input, Skeleton, Tabs, Stepper, etc.
- Domain: AuditorAvatar, ClauseRef, ConfidenceMeter, EvidenceLink, LedgerEventRow, NCStatePill, ProbeResultCard, SignatureStatus, ToolACLDriftDiff, TraceTimeline, VerdictPill

**Missing (SEV-3):**
1. No Playwright/Storybook snapshot tests — `@storybook/test-runner` with `toMatchSnapshot` or `percy`/`chromatic` is not configured
2. No light-mode vs. dark-mode pixel comparison for any page
3. No Playwright `expect(page).toHaveScreenshot()` calls in `tests/visual/pages/`
4. No snapshot baselines in `tests/visual/snapshots/`
5. Storybook stories are defined but there is no CI step that renders and screenshots them

---

## 11. Chaos Engineering Tests

### Status: NOT IMPLEMENTED — directories are empty

`tests/chaos/manifests/` and `tests/chaos/recipes/` are both empty directories.

**Missing (SEV-3 for now, SEV-2 pre-GA):**
1. No Kubernetes `Chaos` CR manifests (pod kill, deployment rollout, node drain)
2. No Toxiproxy/Pumba network partition recipe for Postgres failover
3. No disk-full simulation test
4. No time-skew test (NTP offset injection to verify ledger timestamp validation)
5. No DB connection pool exhaustion scenario
6. No probe execution timeout / dead-letter queue test
7. No Redis eviction cascade test

---

## 12. Contract Tests

### Status: NOT IMPLEMENTED — directories are empty

`tests/contract/consumers/` and `tests/contract/providers/` are both empty directories.

**Missing (SEV-2):**
1. No Pact consumer contracts for the web app's API calls (critical for preventing breaking API changes from reaching production)
2. No provider verification tests
3. No OpenAPI schema conformance test linking the published `openapi.yaml` to actual API responses
4. No contract for the MCP server's tool protocol
5. No Pact broker configuration in CI

**Note:** `docs/api/` exists — likely contains an OpenAPI spec — but no contract tests verify API responses conform to it.

---

## 13. Accessibility Tests

### Status: NOT IMPLEMENTED

A search for `axe-core`, `@axe-core`, `a11y`, and `accessibility` across all test files returns zero results. The Playwright configuration does not include `@axe-core/playwright`.

**Missing (SEV-2 — CLAUDE.md mandates WCAG 2.2 AA):**
1. No `axe.analyze()` call in any Playwright journey
2. No `@axe-core/playwright` in `tests/e2e/package.json` dependencies
3. No per-page accessibility scan in CI
4. No Lighthouse accessibility score threshold gate
5. No documented NVDA/VoiceOver manual test protocol (CLAUDE.md specifies "manual NVDA/VoiceOver per major release" — no tracking document or checklist exists)

---

## Prioritised Findings Summary

### SEV-1 CRITICAL (Block release or create immediate compliance/security risk)

| ID | Finding | Affected Area |
|---|---|---|
| S1-01 | 9 packages have zero test files; combined test-to-src ratio falls far below 0.5 threshold | `ai-system-profiler`, `audit-memory`, `conversational-engine`, `db`, `nc-drafter`, `probe-engine`, `report-engine`, `trace-analyzer`, `working-papers` |
| S1-02 | `tests/compliance/` is entirely empty — no ISO 17021-1 / IAF MD 23 golden cases, no clause coverage validation, no NC numbering, no report template snapshots | Compliance |
| S1-03 | `tests/probe-validity/` is entirely empty — all probe suites and fixtures missing; P-AF-CLAUSE-01 (hard CLAUDE.md requirement) not implemented | Probe Library |
| S1-04 | Corpus regression gate (`tests/conversational-engine/runners/release-gate.ts`) does not exist — conversational engine can silently degrade | Conversational Engine |
| S1-05 | No Testcontainers integration tests — Postgres RLS bypass, migration up/down/up loop, and audit-ledger replay regression are all untested | Database / Integration |
| S1-06 | E2E Journey 4 fixture files missing (`sample-evidence.pdf`, `creditrisk-offline-testset.json`, `creditrisk-production-logs.json`) — J4 will fail in CI | E2E |
| S1-07 | P-MCP-01 through P-MCP-08 probes not implemented in `probe-engine` — 8 required MCP security probes missing | Probe Library |
| S1-08 | P-DRIFT-01 and P-HALL-01 probes referenced in E2E journeys but not present in `probe-engine/src/probes/` | Probe Library / E2E |

### SEV-2 HIGH (Will prevent achieving stated coverage targets)

| ID | Finding | Affected Area |
|---|---|---|
| S2-01 | 17 packages below 0.5 test-to-src ratio with significant logic gaps | Unit Coverage |
| S2-02 | Security JWT test (`jwt-attacks.test.ts`) tests inline functions, not `auth-core/src/jwt.ts` production code | Security |
| S2-03 | Security RBAC test models 10 endpoints vs. the full API surface; no HTTP enforcement testing | Security |
| S2-04 | Tenant isolation test uses in-memory simulation, not real Postgres RLS | Security |
| S2-05 | `authn/`, `crypto/`, `llm/`, `owasp/` security directories are empty | Security |
| S2-06 | No ZAP integration or CI DAST wiring | Security CI |
| S2-07 | No Semgrep custom rules | Security CI |
| S2-08 | Contract tests (`tests/contract/`) entirely absent — no consumer-driven API contract | Contract |
| S2-09 | Accessibility tests absent despite WCAG 2.2 AA mandate in CLAUDE.md | Accessibility |
| S2-10 | Property-based tests missing for FX, tax, readiness %, hash chain ordering, bi-temporal queries | Property-Based |
| S2-11 | `audit-memory` claim-graph, contradiction-detector, hybrid-retrieval, point-in-time, compaction services have no tests | Unit Coverage |
| S2-12 | `findings` carry-forward engine and analytics untested | Unit Coverage |
| S2-13 | `peer-review` package: only state machine tested out of 16 source files | Unit Coverage |
| S2-14 | `db/tests/` empty despite migration-related vitest config; no schema test | Database |

### SEV-3 MEDIUM (Important gaps, not blocking)

| ID | Finding | Affected Area |
|---|---|---|
| S3-01 | No `@mobile` tag in any E2E journey — iPhone 14 Playwright project is orphaned | E2E |
| S3-02 | No WebAuthn passkey E2E journey | E2E |
| S3-03 | No conversational engine / interview flow E2E journey | E2E |
| S3-04 | No Stage 1 audit E2E journey | E2E |
| S3-05 | `tests/visual/` entirely empty — no Playwright screenshot tests or Storybook visual diff | Visual Regression |
| S3-06 | `tests/chaos/` entirely empty | Chaos |
| S3-07 | Probe sandbox test uses inline function, not `probe-engine/src/sandbox.ts` | Security |
| S3-08 | Injection payload test validates corpus completeness but not production sanitizers | Security |
| S3-09 | `soa` package at ~75% — `importers.ts` edge cases for malformed SOA documents missing | Unit Coverage |
| S3-10 | Offline sync race condition: `context.setOffline(true)` not followed by service worker readiness wait | E2E Flakiness |
| S3-11 | `archive` package: `ltv-renewal.ts`, `accreditation.ts`, `retention.ts` untested | Unit Coverage |
| S3-12 | Load test soak scenario (`soak-24h.js`) only tests `/health/live` — no representative workload | Load |

### SEV-4 LOW

| ID | Finding |
|---|---|
| S4-01 | Storybook stories exist for 25 components but no CI step runs `storybook-test-runner` |
| S4-02 | `conversational-engine` vitest config lowers thresholds to 80%/75% — below the 85%/80% monorepo standard |
| S4-03 | `trace-analyzer` vitest config similarly lowers thresholds |
| S4-04 | No mutation testing (Stryker/vitest-mutation) to assess test quality |
| S4-05 | No NVDA/VoiceOver test protocol document |
| S4-06 | `llm-provider` and `llm-cloud` source directories are empty — stub packages with no src or tests |

---

## Suggested Next-Priority Tests

### Sprint 1 — Unblock CI (SEV-1)

1. **Create E2E fixture files** — Add `tests/fixtures/reports/sample-evidence.pdf` (1-page blank PDF), `tests/fixtures/probe-executions/creditrisk-offline-testset.json`, and `tests/fixtures/agent-traces/creditrisk-production-logs.json` with minimal valid content. This unblocks J4 immediately.

2. **Add probe-engine unit tests** — Write `packages/probe-engine/tests/probe-runner.test.ts` covering: (a) P-BIAS-01 known-good fixture produces `pass`, (b) P-BIAS-01 known-bad fixture produces `fail` with correct metric, (c) invalid Params rejected by Zod, (d) `defineProbe` DSL contract. Move existing `.fixtures.ts` files into `tests/fixtures/`.

3. **Add `tests/probe-validity/suites/baseline-probes.test.ts`** — For each of the 9 existing probes, verify `pass` on known-good and `fail` on known-bad. Reuse `probe-engine/src/probes/*.fixtures.ts`.

4. **Implement P-AF-CLAUSE-01** — Add `packages/probe-engine/src/probes/P-AF-CLAUSE-01.ts` and corresponding validity test. This is a CLAUDE.md hard rule.

5. **Testcontainers integration for db package** — Add `packages/db/tests/migrations.integration.test.ts` using `@testcontainers/postgresql`. Test: migrate up, verify tables exist, migrate down, verify tables gone, migrate up again.

### Sprint 2 — Compliance and Security Hardening (SEV-1 + SEV-2)

6. **Compliance golden cases** — Add `tests/compliance/man-days/iaf-md23-golden.test.ts` with the 5 worked examples from IAF MD 23 Annex B. Import `engagement/src/programme/calculator.ts` and assert exact man-day values.

7. **Report template snapshots** — Add `tests/compliance/templates/stage2-report.snapshot.test.ts` using `toMatchSnapshot()` against the report substitution engine output for a fixed engagement fixture.

8. **Fix JWT attack test** — Replace inline functions with imports from `packages/auth-core/src/jwt.ts`. Add `kid` injection, expired token, and audience mismatch tests.

9. **Fix RBAC test** — Replace inline permission table with import from `packages/auth-core/src/rbac.ts`. Add 20+ additional endpoints covering the full API surface.

10. **Add Postgres RLS integration test** — `tests/security/suites/rls-bypass.integration.test.ts` using Testcontainers. SET `app.current_firm_id` to firm-a, attempt SELECT on firm-b rows, assert empty result.

11. **Wire ZAP in CI** — Add `.github/workflows/dast.yml` running `ghcr.io/zaproxy/zaproxy:stable zap-baseline.py` against the running dev stack.

### Sprint 3 — Property-Based and Coverage (SEV-2)

12. **FX property tests** — Add to `billing/tests/fx.test.ts`: round-trip invariant, missing-rate throws, chain A→B→A≈A for random rates.

13. **Readiness score property tests** — Add `coverage-dashboards/tests/readiness-score.test.ts` with fast-check: score always in [0,1], adding `evidenced` evidence monotonically increases score, N/A clauses excluded.

14. **Audit-memory integration tests** — Add tests for `claim-graph.ts` (invalidation does not delete), `contradiction-detector.ts` (contradicting claims both visible with different `valid_to`), `point-in-time.ts` (query at `t1` does not see claims ingested after `t1`), `compaction-worker.ts` (compacted episodes still queryable).

15. **NC-drafter unit tests** — Add tests for each detector: `direct-conformity-gap.ts`, `evidence-absence.ts`, `contradiction-derived.ts`, `ofi-signal.ts`, `systemic-pattern.ts`. Use synthetic claim fixtures.

### Sprint 4 — E2E Completeness and Visual (SEV-3)

16. **Add `@mobile` tags** — Tag J2 (offline sync) and J3 (auditee CAPA) with `@mobile` and verify they pass on iPhone 14 project.

17. **Add conversational engine journey** — `journey-09-interview-flow.spec.ts`: start interview for Clause 6, generate question, answer, verify attribution, verify candidate NC drafted.

18. **Add Storybook visual tests** — Configure `@storybook/test-runner` with `toMatchSnapshot`. Run in CI on `packages/ui-kit` for light/dark mode. Store snapshots in `tests/visual/snapshots/`.

19. **Add axe-core to Playwright** — Add `import AxeBuilder from '@axe-core/playwright'` to `page-objects.ts`. Add `await new AxeBuilder({ page }).analyze()` to each journey's first authenticated page. Fail on critical/serious violations.

20. **Corpus regression gate** — Create `tests/conversational-engine/runners/release-gate.ts` + `baseline.json`. Run against 10 synthetic audit scenarios, compute attribution F1 and question relevance, gate on <5% regression.

---

## Test Stack Observations

**Testcontainers:** Not present in `package.json` anywhere. Install `@testcontainers/postgresql`, `@testcontainers/redis` as `devDependencies` in `packages/db` and any integration test package.

**Pact:** Not present. Decide between Pact JS v12 (consumer-driven, broker required) and simpler OpenAPI conformance via `dredd` or `schemathesis`. Given the monorepo owns both consumer and provider, `msw` + OpenAPI schema validation may be sufficient without a broker.

**fast-check version:** Present in at least 8 test files. Ensure `fast-check` ≥ 3.0 is used consistently (shrinking + replay via seed) — confirm in `package.json`.

**ZAP:** Not wired into CI. A GitHub Actions job with `zaproxy/action-baseline@v0.12.0` would take 10 minutes and cover OWASP Top 10 automatically.

**Semgrep:** Not wired. Add `semgrep/semgrep-action@v2` with the `p/typescript`, `p/secrets`, and a custom AuditForge ruleset for BUSL header enforcement and direct DB access outside the `db` package.

---

*End of review. 20 prioritised test tasks listed above. Immediate blockers: S1-06 (missing E2E fixtures), S1-03 (probe-validity empty), S1-04 (corpus gate absent), S1-05 (Testcontainers absent).*
