# Threat Model — AuditForge ISO 42001

<!-- SPDX-License-Identifier: BUSL-1.1 -->

This directory captures the security threat model that satisfies the
per-phase **security review** gate from `CLAUDE.md`.

## Files

- [`system-context.md`](./system-context.md) — trust zones, Mermaid
  architecture diagram, list of in-scope data flows.
- [`stride-analysis.md`](./stride-analysis.md) — STRIDE per data flow
  with countermeasures and residual risk.
- [`dread-scoring.md`](./dread-scoring.md) — DREAD score per identified
  threat, prioritized list.
- [`mitigation-tracker.md`](./mitigation-tracker.md) — threat → mitigation
  → status table, with ADR cross-references.

## Update Cadence

- **Per PR**: any data flow change requires the PR author to update
  the relevant STRIDE row and (if a new threat) score it in DREAD.
- **Per phase**: full re-score; `mitigation-tracker.md` reviewed for
  status drift.
- **Quarterly**: external review checkpoint.

## Related ADRs

The following ADRs are direct sources of mitigations:

- ADR-0017 (Drizzle + RLS) — defense in depth on Z3.
- ADR-0018 (zustand auth interim) — interim risk M-001.
- ADR-0020 (signed audit ledger) — repudiation defense across all flows.
- ADR-0023 (Yjs WS RBAC) — F3 mitigations.
- ADR-0024 (tier router) — F6 routing & cost controls.
- ADR-0025 (air-gap + consent) — F6 isolation guarantees.
- ADR-0027 (CSP interim) — interim risk M-025.

## Tools

The threat model is *human-edited* Markdown. We deliberately avoid a
proprietary threat-modelling tool so the artefact lives in the same
review pipeline as the source code.
