<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - CLAUDE.md (85% unit / 80% branch targets)
  - playwright.config.ts
  - packages/test-helpers/
-->

# Testing Strategy

> Test architecture, coverage targets, and how to run each test type.

---

## Coverage Targets (CLAUDE.md Mandate)

- **85% statement coverage** per package.
- **80% branch coverage** per package.

Coverage is measured by Vitest. The CI pipeline fails if either target
is missed for any package that has production code.

---

## Test Types

### Unit Tests (Vitest)

- Location: `<package>/src/**/*.spec.ts` and `<package>/src/**/*.test.ts`.
- Scope: pure functions, state machines, domain logic.
- Run: `pnpm test:unit` (all packages) or
  `pnpm --filter @auditforge/audit-memory test:unit`.
- Mocking: use Vitest's `vi.mock()` and the factories in
  `packages/test-helpers/src/factories/`.
- Avoid mocking the database in unit tests — use in-memory fakes from
  `packages/test-helpers/src/fakes/`.

### Integration Tests (Vitest + real Postgres)

- Location: `apps/api/test/**/*.integration.spec.ts`.
- Scope: API endpoints, repository layer, RLS policies.
- Database: a real Postgres instance (Docker Compose test profile).
  Each test suite creates an isolated schema via `tenancy-core`'s
  test helper.
- Run: `pnpm test:integration`.

### End-to-End Tests (Playwright)

- Location: `tests/e2e/journeys/`.
- Scope: full user journeys (create engagement, run interview, promote
  finding, sign report).
- Run: `pnpm test:e2e` (requires full stack running).
- Key journey files:
  - `wave1-passkey-enrollment.spec.ts`
  - `wave2-evidence-upload.spec.ts`
  - `wave3-live-interview.spec.ts`
  - `wave3-working-paper-collab.spec.ts`
  - `wave4-sign-and-publish.spec.ts`

### Load Tests (k6)

- Location: `tests/load/`.
- Scope: API throughput, evidence extraction queue, WebSocket room
  scalability.
- Run: `k6 run tests/load/api-throughput.js`
- Required for per-phase performance gates.

### SAST (Semgrep)

- Location: `semgrep/`.
- Custom rules:
  - `free-form-llm-output.yml` — flags any LLM output path that does
    not pass through the schema-constrained extractor.
  - `ledger-write-without-sign.yml` — flags any ledger write that does
    not call `signEvent()`.
  - `rls-bypass-without-guard.yml` — flags Drizzle queries that bypass
    RLS without an explicit guard.
- Run: `semgrep --config semgrep/ .`

### Probe Validity Tests

- Location: `tests/probe-validity/`.
- Scope: CI probe `P-AF-CLAUSE-01` (re-ranker only emits valid clause
  IDs); probe library correctness checks.
- Run: `pnpm test:probe-validity`.

---

## Fixtures and Test Helpers

`packages/test-helpers` exports:

- `createTestTenant(db)` — provisions an isolated tenant schema.
- `createTestAuditor(db, tenant)` — creates an auditor user.
- `createTestEngagement(db, tenant, opts)` — creates an engagement in
  the specified mode and state.
- `FakeSigningProvider` — deterministic Ed25519 implementation for tests.
- `FakeLLMProvider` — returns deterministic responses without hitting
  real LLM endpoints.
- `FakeTSAClient` — returns a valid mock RFC 3161 token.

---

## Writing a New Test

1. For a new package function:
   ```typescript
   // packages/my-package/src/my-thing.spec.ts
   // SPDX-License-Identifier: BUSL-1.1
   import { describe, it, expect } from 'vitest';
   import { myThing } from './my-thing';

   describe('myThing', () => {
     it('returns expected result for valid input', () => {
       expect(myThing('input')).toBe('expected');
     });
   });
   ```
2. For an API endpoint:
   - Add a fixture in `packages/test-helpers/src/factories/`.
   - Write an integration test in `apps/api/test/`.
   - Use `createTestTenant` to isolate the test's DB state.

---

## Cross-References

- [04-development-workflow.md](04-development-workflow.md) — CI test
  gates.
- `packages/test-helpers/` — test utility source.
- `playwright.config.ts` — Playwright configuration.
