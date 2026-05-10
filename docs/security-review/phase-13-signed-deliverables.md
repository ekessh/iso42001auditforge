# Phase 13 Security Review — Signed Deliverables

<!-- SPDX-License-Identifier: BUSL-1.1 -->

- **Phase**: 13
- **Date**: 2026-05-10 (retrospective for Wave 1-2)
- **Scope**: PDF/A-3 export, Ed25519 signing, RFC 3161 TSA, MCP server
  scaffold.

## ADRs in scope

- ADR-0016 (MCP server scaffold)
- ADR-0020 (Hash-chained ledger + Ed25519 + RFC 3161 TSA)
- ADR-0022 (PDF/A-3 self-rolled, veraPDF gate)

## Threat-model delta

- F5 (report publish) — full chain: confirmation token → Ed25519 → TSA
  token → PDF/A-3 → veraPDF gate. Verifier replays end-to-end.
- F7 (MCP tool call) — only `report.publish` mutates; per-tool
  fingerprint check; signed receipts.

## Open items

- HSM/KMS migration (M-005) — Phase 15 deliverable.
- MCP transport (Streamable HTTP, stdio) — Phase 15 deliverable.

## Sign-off

- [ ] Reviewer 1 (security): _name_ — _date_
- [ ] Reviewer 2 (compliance lead): _name_ — _date_
