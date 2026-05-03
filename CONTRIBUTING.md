# Contributing to AuditForge

Thanks for your interest. AuditForge is licensed under **BUSL-1.1** (see [LICENSE](LICENSE)).

## Before You Start

1. Read [docs/DESIGN.md](docs/DESIGN.md) — the design spec.
2. Read [CLAUDE.md](CLAUDE.md) — build conventions.
3. Read [CLA.md](CLA.md) — sign off your commits with `git commit -s`.
4. Read [TRADEMARK.md](TRADEMARK.md) — be careful with the AuditForge name.

## Development Setup

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Conventional Commits

`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`, `security:`. Header line is checked by CI.

## PR Checklist

- [ ] Branch from `main`. Keep PRs small and focused.
- [ ] Lint clean (`pnpm lint`)
- [ ] Type-check clean (`pnpm typecheck`)
- [ ] Unit + integration tests pass (`pnpm test`)
- [ ] No new SAST findings (Semgrep)
- [ ] No secrets (gitleaks)
- [ ] OpenAPI updated for API changes
- [ ] CHANGELOG entry
- [ ] ADR updated for cross-cutting changes
- [ ] `SPDX-License-Identifier: BUSL-1.1` on every new source file
- [ ] DCO sign-off on every commit (`-s`)

## Architecture Decisions

Non-trivial changes get an ADR in `docs/adr/` (template at `docs/adr/_template.md`). Reference the ADR in the PR.

## Testing Requirements

- Unit coverage: 85% lines / 80% branches
- Property-based tests for parsers, calculators, state machines (fast-check)
- Integration tests use Testcontainers (real Postgres + Redis)
- E2E tests in Playwright (Chromium + Firefox + WebKit + mobile viewports)
- Visual regression for UI-heavy PRs
- Bug fixes MUST add a regression test

## Reviews

- 2 reviewers including 1 senior maintainer
- Security-sensitive code requires +1 from security
- Compliance-sensitive code (audit calc, report templates) requires sign-off from a certified ISO 42001 lead auditor

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Auditors hate sloppy work — write code accordingly.
