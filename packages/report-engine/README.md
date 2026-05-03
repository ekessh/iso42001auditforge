# @auditforge/report-engine

Report engine for the AuditForge ISO/IEC 42001 lead-auditor workbench. Implements Section 3.9 (Reporting) and Phase 9 of `auditforge.md`, and the issuance side of ADR-0006 (signed audit file).

License: BUSL-1.1.

## Scope

This package is a **pure domain library**: no I/O side effects beyond what its dependents inject. Hardware-key access (WebAuthn, PKCS#11), TSA HTTP, and binary writers (`docx`, `pdf-lib`, `pdfme`, `pdfkit`, `exceljs`) are wired by the dependents (`apps/api`, `apps/desktop`). The renderers in this package emit a fully-resolved render tree plus the bytes when a writer is provided via the host adapter; otherwise, they emit a deterministic intermediate representation (`RenderArtifact`) that hosts can hand to writers.

This split keeps the package:

- testable without spinning up Word, PDF, or Excel
- portable to Electron (desktop) and Node (server)
- diffable (intermediate representation is plain JSON)

## Modules

- `domain/` — `ReportTemplate`, `ReportInstance`, `ReportSection`, `ReportFinding`, `ReportSignatureBlock` types + Zod schemas
- `templates/` — Stage 1, Stage 2, Surveillance, Recertification, Findings Summary, Technical Assessment Annex, Cross-Framework Annex (data-driven JSON)
- `substitution/` — strict variable substitution engine (Mustache-like), nested loops for findings/probes, EN locale + locale param, custom helpers (`dateFormat`, `clauseLink`, `verdictPill`, `findingNo`)
- `renderers/` — `docx`, `pdf` (PDF/A-3), `xlsx` adapters that turn a `RenderArtifact` into bytes via host-supplied writers
- `branding/` — CB letterhead injection: logo, address, registration numbers, header/footer, color theme override
- `signing/` — `SignatureRequest` interface, CAdES-LT (binary) + PAdES-LTV (PDF), RFC 3161 TSA token embed, multi-signer ordering-independent verification, LTV renewal helper
- `versioning/` — draft history (every save = a version), text + structural diff, immutable signed finals, branched re-edits

## ADR alignment (ADR-0006)

- Hardware-backed signing: this package emits the *to-be-signed* payload and verifies an opaque hardware-produced signature. It does **not** access keys.
- CAdES-LT for binary, PAdES-LTV for PDF.
- TSA tokens embedded; `renewLtv()` re-stamps and re-embeds at renewal time.
- Multi-signer (lead auditor + peer reviewer + technical expert) supported with per-signer policy.

## Variable substitution

Strict by default — undefined variables raise `TemplateRenderError` with line + path context. Type-safe via per-template `VariableSchema` (Zod). Helpers:

- `dateFormat(value, format)`
- `clauseLink(clause)` — turns `5.2` into linked text "ISO 42001 Clause 5.2"
- `verdictPill(verdict)` — text rendering of verdict colored pills
- `findingNo(number)` — formats `NC-2026-014`

## Templates as data

Every template is an external JSON file under `templates/` (mirrored at runtime via `src/templates/registry.ts`). External lead auditors review templates by reading these JSON files and viewing diffs in PRs.

## Signing & long-term validation

`SignatureRequest` produces a payload byte string and a `SignerPolicy` (which signers, in which order, with which type). The host computes the hardware-backed signature externally (passkey, YubiKey, smart card via PKCS#11). The engine then:

- embeds the signature + RFC 3161 TSA token (CAdES-LT or PAdES-LTV)
- accepts multi-signer payloads in any commit order
- exposes `verifySignature(bytes, manifest, trustStore, atTime)` that validates years later
- exposes `renewLtv(bytes, tsa)` that fetches a fresh TSA token and re-embeds

Software-only signing is permitted for non-production environments (clearly marked).

## Versioning + diff

- Every save creates a new version with content hash + parent hash.
- `diffVersions(a, b)` returns text diff per section + structural diff for tables/lists.
- `freezeAsFinal(version, signatures)` makes a signed final immutable; subsequent edits create a new draft branched from the final.

## Tests

60+ Vitest tests across:

- substitution edge cases (nested loops, escape, undefined-strict)
- per-template golden fixtures (deterministic snapshot of the intermediate representation)
- PDF/A-3 marker presence
- CAdES-LT and PAdES-LTV signing + verification round-trip with synthetic test keys
- multi-signer order-independence
- LTV renewal logic
- versioning + diff (text and structural)
