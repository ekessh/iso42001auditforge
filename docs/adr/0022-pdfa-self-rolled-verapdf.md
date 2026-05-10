# ADR-0022: Self-rolled PDF/A-3 export with veraPDF-CLI validation

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, compliance review
- **Phase**: 13 (signed deliverables)
- **Tags**: reporting, pdf, pdfa, archival, dependencies

## Context

ISO 42001 audit reports are durable artefacts that must remain
human-readable and machine-verifiable for at least the certification cycle
(three years for ISO 17021-1). PDF/A is the ISO standard for long-term
archival of electronic documents (ISO 19005). PDF/A-3 (ISO 19005-3:2012)
permits embedded files of arbitrary type, which we use to attach the
machine-readable JSON form of the report alongside the human-readable PDF.

We needed a PDF/A-3 generator. The market splits into:

- Commercial libraries (PSPDFKit, ABCpdf, iText commercial license,
  Aspose.PDF) — high quality, expensive per seat, opaque source.
- LGPL/AGPL libraries (iText AGPL, OpenPDF, PDFBox) — license-incompatible
  with our BUSL-1.1 source distribution, or operationally awkward.
- Headless-Chrome `printToPDF` — produces PDF, not PDF/A; fails veraPDF.
- Self-rolled using `pdf-lib` (MIT) + `pdfa-utils` (MIT) — full control,
  no commercial dependency, requires our own conformance work.

## Decision

Self-roll PDF/A-3 export under `packages/report-engine` using:

- `pdf-lib` for low-level PDF object model.
- A small in-house PDF/A-3 helper that:
  - Embeds the ICC profile (`sRGB IEC61966-2.1`) per PDF/A requirements.
  - Adds the XMP metadata block (`pdfaid:part=3`, `pdfaid:conformance=B`).
  - Sets `MarkInfo`, `StructTreeRoot`, and tagged-PDF entries for
    accessibility.
  - Embeds fonts with full subsets (no Type 3, no missing-glyph fallbacks).
  - Attaches the machine-readable JSON sibling via the PDF/A-3 `/AF`
    (associated files) mechanism.
- A **veraPDF-CLI** validation hook in CI: every published report PDF is
  validated against PDF/A-3-B; failure is a blocking gate. The hook lives
  in `scripts/verify-pdfa.mjs` and is invoked from `release.yml`.

The signing flow (ADR-0020) signs the canonical JSON sibling and
embeds the signature in the PDF metadata so a downstream verifier can
extract the JSON, recompute the hash, and check the Ed25519 signature
without re-parsing the PDF stream.

## Consequences

### Positive

- **No commercial license cost.** Important for the BUSL-1.1 distribution
  model and for downstream community redistribution.
- **No AGPL contagion.** `pdf-lib` is MIT, compatible with our BUSL-1.1
  source.
- **Verifiable conformance.** veraPDF (free, open-source) is the de
  facto reference validator for PDF/A; a green veraPDF run is the gate.
- **Auditor extension.** Custom annotations (clause-link sidebar,
  evidence drawer) are easy to add when we own the generator.

### Negative

- **PDF/A-3 conformance is hard.** We had to chase down `MarkInfo`,
  ICC, fonts, and XMP edge cases; veraPDF found multiple bugs in early
  drafts. We accept the engineering cost for the license freedom.
- **No PDF/A-1 fallback.** Some downstream archival systems still require
  PDF/A-1b; we will add a "downgrade" path in Phase 14 if a Pilot client
  asks.

### Neutral

- The veraPDF-CLI dependency is downloaded once during CI cache
  warm-up; release artefacts include the validation report alongside
  the PDF.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Headless Chrome printToPDF | Produces PDF/1.x; fails veraPDF. |
| iText AGPL | License contagion incompatible with BUSL-1.1 distribution. |
| iText commercial | Per-seat licensing fights the BUSL-1.1 community-redistribution story. |
| OpenPDF | LGPL; license contagion question is debatable; tooling worse than `pdf-lib`. |

## Compliance Implications

- **ISO 19005-3:2012** (PDF/A-3): conformance verified by veraPDF on
  every release.
- **ISO 17021-1 Clause 9.4.10** (records): PDF/A-3 archival format for
  audit records satisfies the "retain in legible form" requirement.
- **eIDAS Art. 41** (electronic time stamps): the embedded TSA token
  (ADR-0020) is preserved through the PDF/A-3 export.

## Follow-Ups

- [ ] Phase 14: PDF/UA accessibility tags (currently we set `MarkInfo`
      but not full structure tree for content beyond headings).
- [ ] Phase 14: PDF/A-1b downgrade path for legacy archival systems.
- [ ] Phase 14: localized fonts (currently Latin-1 + extended Latin
      only).
