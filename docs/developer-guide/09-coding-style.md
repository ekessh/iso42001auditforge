<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - CLAUDE.md
  - eslint.config.mjs
-->

# Coding Style

> Conventions enforced in CI. Violations block merge.

---

## TypeScript

- **Strict mode** — every `tsconfig.json` extends `tsconfig.base.json`
  which has `"strict": true`. No exceptions.
- **No `any`** — use `unknown` and narrow, or a proper type.
- **No comments unless WHY is non-obvious** (CLAUDE.md). The code
  should be readable without comments. A comment is acceptable only
  when the why cannot be expressed in the code itself.
- **Import ordering**: external packages first, then workspace packages
  (`@auditforge/*`), then relative imports. ESLint enforces this via
  `import/order`.
- **No barrel files** (no `index.ts` re-exporting everything from a
  directory). Direct imports prevent tree-shaking issues and circular
  dependencies.

---

## SPDX Headers

Every new source file must begin with the SPDX header:

- **TypeScript / JavaScript**: `// SPDX-License-Identifier: BUSL-1.1`
- **Python**: `# SPDX-License-Identifier: BUSL-1.1`
- **YAML / TOML**: `# SPDX-License-Identifier: BUSL-1.1`
- **Markdown / HTML**: `<!-- SPDX-License-Identifier: BUSL-1.1 -->`
- **SQL**: `-- SPDX-License-Identifier: BUSL-1.1`

CI runs `scripts/license-check.mjs` to verify every source file. Files
missing the header block the build.

---

## Hard Rules from CLAUDE.md

These rules are not stylistic preferences — violating them is a bug:

1. **Schema constraints first** — LLM output must always pass through
   the schema-constrained extractor. Free-form LLM text stored to the
   database is a bug. Semgrep rule `free-form-llm-output.yml` enforces.

2. **Every ledger write calls `signEvent()`** — Semgrep rule
   `ledger-write-without-sign.yml` enforces.

3. **Engine outputs are drafts** — service code must not write
   `auditor_confirmed=true` without a `principal_id` from an auditor
   session. The `AuditLedgerService.emitConfirmed()` method requires a
   `principalId` argument; call the un-confirmed variant for engine
   outputs.

4. **Candidate findings never visible to auditees** — do not add the
   auditee role to any RLS policy on `candidate_findings`.

5. **Re-ranker outputs only valid clause IDs** — the clause attribution
   service must validate the LLM's clause IDs against the catalogue
   before writing claims. CI probe `P-AF-CLAUSE-01` enforces.

6. **LLM never invents a question** — the question generator may only
   return library questions or follow-ups derived from library questions.
   Free-form question generation from the LLM is a bug.

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| TypeScript class | PascalCase | `AuditLedgerService` |
| TypeScript function | camelCase | `signEvent` |
| TypeScript constant | camelCase | `defaultTimeout` |
| TypeScript type / interface | PascalCase | `LedgerEvent` |
| Zod schema | PascalCase ending in `Schema` | `CreateEngagementSchema` |
| DTO type (inferred from Zod) | PascalCase ending in `Dto` | `CreateEngagementDto` |
| Database table | snake_case | `audit_ledger_events` |
| Database column | snake_case | `tenant_id` |
| Ledger event type | `<domain>.<verb>` in snake_case | `engagement.created` |
| Probe ID | `<CATEGORY>-<NNN>` | `P-LLM-001`, `AC-6-1-2` |

---

## Python (Sidecars)

- **Ruff** for linting and formatting (configured in `services/*/pyproject.toml`).
- **Type annotations** on all public functions.
- **Pydantic v2** for data models (schema-constrained gRPC responses).
- SPDX header on every `.py` file.

---

## Cross-References

- [CLAUDE.md](../../CLAUDE.md) — the authoritative rule set.
- `eslint.config.mjs` — ESLint configuration.
- `semgrep/` — custom Semgrep rules.
