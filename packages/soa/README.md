# @auditforge/soa

SPDX-License-Identifier: BUSL-1.1

Statement of Applicability (SoA) module for AuditForge ISO 42001.
Implements design Section 3.8 / Phase 8 - SoA importer + reviewer.

## Scope

Per-control SoA review for the auditee's declared applicability of Annex A
controls. Provides:

- Domain types: `SoaRecord`, `SoaReview`, `SoaImportSession`
- Importers: XLSX, CSV, JSON, PDF table (parser-agnostic - inject your own
  byte-to-grid parser; the importer normalises rows to `SoaRecord`)
- Service: `SoaReviewer` with verdict state machine
  (`pending -> confirm | dispute | raise_nc | na`)
- Completeness checker against the loaded Annex A control catalogue

## Boundary

- Pure TypeScript domain + service. No I/O frameworks, no HTTP layer.
- No third-party file format parsers are pulled in; the importers accept
  plain text / structured JSON / pre-parsed grids so the package stays
  dependency-light. Application layers wire `xlsx`, `papaparse`,
  `pdf2json` etc. and pass parsed rows in.
- Refuses absolute or directory-traversing file paths in import sessions
  to keep callers honest about sandboxing.

## State machine

```
pending --confirm--> confirmed
pending --dispute--> disputed
pending --raise_nc--> nc_raised
pending --na--> na
disputed --raise_nc--> nc_raised
disputed --confirm--> confirmed
nc_raised --withdraw--> disputed
```

Re-confirming a confirmed verdict is a no-op (idempotent). All other
illegal transitions throw `StateMachineError`.

## Completeness

`checkCompleteness` returns a per-category breakdown of which Annex A
controls are present in the SoA, missing, or only present as inapplicable
- enabling the auditor to spot omitted controls before reaching the
review stage.
