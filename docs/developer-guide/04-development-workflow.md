<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - CONTRIBUTING.md
  - CLAUDE.md
-->

# Development Workflow

> Conventional Commits, DCO sign-off, branch strategy, and code review
> requirements.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, deployable. Protected. All PRs target `main`. |
| `feat/<name>` | Feature development. Branch from `main`. |
| `fix/<name>` | Bug fixes. Branch from `main`. |
| `chore/<name>` | Build, tooling, dependency updates. |
| `docs/<name>` | Documentation only. |

Never commit directly to `main`. All changes go through pull requests.

---

## Conventional Commits

Every commit message must follow
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

Signed-off-by: Your Name <you@example.com>
```

**Type**: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`,
`build`, `ci`.

**Scope** (optional): the package or module affected
(e.g. `audit-memory`, `conversational-engine`, `api/findings`).

Examples:

```
feat(conversational-engine): add adaptive question evolution sub-engine

Signed-off-by: Jane Auditor <jane@example.com>
```

```
fix(signing): use JCS canonicalization before Ed25519 sign

Without JCS, key-order differences in payload JSON produced
different hashes across platforms, breaking cross-platform
chain verification.

Signed-off-by: Jane Auditor <jane@example.com>
```

---

## DCO Sign-Off

Every commit must carry a DCO sign-off line. Use `git commit -s` to
add it automatically. CI rejects unsigned commits.

```bash
git commit -s -m "feat(api): add coverage endpoint"
```

Corporate contributors should also sign the CLA (see
[CLA.md](../../CLA.md)).

---

## Pull Request Requirements (Per-PR Gates)

Before a PR can be merged (CLAUDE.md mandate):

1. **Two reviewers** — at least one senior; +1 security reviewer for
   any PR touching auth, signing, ledger, or RLS.
2. **Lint + typecheck clean** — `pnpm lint && pnpm typecheck` with zero
   errors.
3. **Unit + integration tests pass** — `pnpm test:unit && pnpm test:integration`.
4. **No new SAST/SCA findings** — Semgrep and `pnpm audit` must be clean.
5. **No secrets** — Gitleaks scan runs in CI.
6. **OpenAPI updated** — if the PR adds or changes API endpoints,
   the generated OpenAPI spec must be regenerated:
   `pnpm --filter @auditforge/api gen:openapi`.
7. **SPDX header** on every new source file:
   `// SPDX-License-Identifier: BUSL-1.1` (TypeScript) or
   `# SPDX-License-Identifier: BUSL-1.1` (Python/YAML) or
   `<!-- SPDX-License-Identifier: BUSL-1.1 -->` (Markdown/HTML).
8. **DCO sign-off** on every commit.

---

## Code Review Guidelines

- Review within 24 hours of assignment.
- Approve only if you understand the change and have tested it locally
  for any non-trivial feature.
- For ledger, signing, and RLS changes: trace the happy path and at
  least one failure path manually.
- Use the Conventional Commits PR title format — CI derives the
  changelog from it.
- If the PR introduces an architectural decision, require an ADR.

---

## CI Pipeline

CI runs on every push and PR:

1. `pnpm install` (cached)
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test:unit`
5. `pnpm test:integration` (against a Postgres container)
6. `pnpm build` (Next.js + NestJS production builds)
7. Semgrep SAST (`semgrep/` rules + OWASP rulesets)
8. `pnpm audit` (SCA)
9. Gitleaks (secrets scan)
10. OpenAPI diff check

---

## Cross-References

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — contributor legal
  requirements.
- [09-coding-style.md](09-coding-style.md) — coding conventions.
- [05-testing-strategy.md](05-testing-strategy.md) — test types and
  coverage targets.
