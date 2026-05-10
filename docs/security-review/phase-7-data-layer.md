# Phase 7 Security Review — Data Layer

<!-- SPDX-License-Identifier: BUSL-1.1 -->

- **Phase**: 7 (data layer)
- **Date**: 2026-05-10 (retrospective for Wave 1-2)
- **Scope**: Drizzle schema, RLS policies, outbox, ledger.

## ADRs in scope

- ADR-0017 (Drizzle + RLS via session vars)
- ADR-0020 (Hash-chained ledger + Ed25519 + RFC 3161 TSA)
- ADR-0021 (Outbox pattern)
- ADR-0022 (PDF/A-3 self-rolled)

## Threat-model delta

- F2 (engagement create) — RLS enforced via `with-rls.ts` wrapper; mass-
  assignment guarded by zod schema.
- F5 (report publish) — TSA + ledger + Ed25519 chain implemented.

## Open items

- Integration test that runs against a non-superuser DB role (M-002
  verification) — Phase 8 deliverable.
- Outbox lag monitoring metric — Phase 8 deliverable.

## Sign-off

- [ ] Reviewer 1 (security): _name_ — _date_
- [ ] Reviewer 2 (data lead): _name_ — _date_
