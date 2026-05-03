# ADR-0013: Audit Mode vs Readiness Mode at Engagement Creation

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 7.7
- **Tags**: engagement, modes, governance

## Context

v3 introduces a Readiness Mode for AIMS owners performing self-assessment, distinct from the Audit Mode used by certification bodies for formal audits. Same engine, different terminal states, different framing, different report templates. Mixing the two within a single engagement would invalidate the audit ledger semantics.

## Decision

Mode is selected at engagement creation and cannot change.

- **Audit Mode** (default for CBs): terminates on scope coverage + candidate finding review. Outputs formal audit reports per v2 §3.9, signed by the auditor with hardware-backed key. Findings flow into v2 Finding state machine. Auditee Portal active. Right-pane labels: "Candidate Findings," "Promote to Finding."
- **Readiness Mode** (for AIMS owners and internal auditors): terminates on scope coverage + candidate-NC closure (CAPA implemented and verified, not just reviewed). Outputs Readiness Report with mandatory non-certification disclaimer. Findings flow through simplified internal-CAPA workflow; no external Auditee Portal. Right-pane labels: "Improvement Items," "Add to Action Plan." Report signed by AIMS owner or internal auditor.

A firm using Readiness Mode then engaging a CB for Audit Mode creates two separate engagements. AI System Inventory and SoA can be shared; conversational sessions, claim graphs, and finding sets are distinct. Readiness findings are not admissible as evidence in Audit Mode; the auditor performs their own conformity assessment.

## Consequences

### Positive
- Larger TAM: Readiness Mode opens every organization pursuing ISO 42001, not just CBs.
- Liability isolation: a self-assessment cannot be misread as a certification.
- Pricing tiers reflect different value capture (volume vs lead-auditor workbench).

### Negative
- Two report templates to maintain.
- Two finding workflows.

### Neutral
- Both modes ship in the open core. Premium readiness features (sector packs, regulatory cross-walks, CB matching) remain commercial.

## Alternatives Considered

| Option | Why rejected |
|---|---|
| One mode with a "self-assessment" toggle | Conflates the audit ledger semantics; risks "compliant" claims by self-assessors. |
| Forbid self-assessment entirely | Cuts out the largest user segment and the largest social good. |
| Allow mid-engagement switching | Breaks ledger replay and audit defensibility. |

## Compliance Implications

ISO 17021-1: only accredited CBs can certify; Readiness Mode disclaimer makes this explicit. EU AI Act Art. 17 (post-market monitoring) — Readiness Mode supports continuous self-assessment, complementing third-party certification.

## Follow-Ups

- [ ] Readiness Report template with mandatory disclaimer text.
- [ ] Per-mode UI labels enforced via i18n keys.
- [ ] Engagement-creation wizard mode selector.
