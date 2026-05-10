# Phase 7.5 Security Review — Audit Memory + LLM Provider Abstraction

<!-- SPDX-License-Identifier: BUSL-1.1 -->

- **Phase**: 7.5
- **Date**: 2026-05-10 (retrospective for Wave 1-2)
- **Scope**: claim graph, retrieval orchestrator, LLM tier router,
  air-gap + cloud-consent guards.

## ADRs in scope

- ADR-0024 (Tier router for LLM provider abstraction)
- ADR-0025 (Air-gap + cloud-consent guard at provider layer)
- ADR-0026 (Bi-temporal claim graph in Postgres only)

## Threat-model delta

- F6 (LLM invocation) — air-gap + consent enforcement at provider
  factory + invocation hook. Wave-3 adds CI probe
  (`tests/security/airgap-isolation.spec.ts`) to assert the guarantee
  under code drift.
- New claim-graph data flow falls under F2 (engagement-scoped writes);
  RLS extends naturally.

## Open items

- Cross-provider parity probe (Phase 8) — same prompt across all
  providers in a tier yields semantically equivalent output.
- Learned routing (Phase 16) — not in scope yet.

## Sign-off

- [ ] Reviewer 1 (security): _name_ — _date_
- [ ] Reviewer 2 (LLM lead): _name_ — _date_
