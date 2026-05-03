# ADR-0012: Conversational Audit Engine Outputs Are Always Drafts

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 7.6, 7.7
- **Tags**: governance, ux, audit-integrity

## Context

The Conversational Audit Engine produces questions, attributions, candidate findings, contradiction alerts, and audit-conclusion summaries. If any of these auto-promoted into formal audit state, the engine would be making conformity decisions — outside its mandate and outside ISO 17021-1.

## Decision

Engine outputs are drafts at every stage. Auditor confirmation is the only state-transition trigger.

- Generated questions: visible in the chat as system suggestions; never asked unless the auditor accepts (or edits then accepts).
- Attribution candidates: high-confidence ones auto-link in working papers but require auditor bulk confirmation; medium-confidence ones require explicit per-attribution decisions; low-confidence ones live in a "possibly related" panel, opt-in only.
- Candidate findings: live in the right pane; never enter the v2 Finding state machine without explicit auditor promotion via the **Add** action.
- Contradiction alerts: surface; do not auto-rewrite history.
- Audit conclusion summary: a synthesis the engine offers; the auditor confirms or overrides in the signed report. **The engine never concludes conformity. The auditor does, in the signed report.**

In Readiness Mode the same rule applies; the AIMS owner or internal auditor confirms. The mandatory non-certification disclaimer makes clear that no readiness self-assessment is a certification.

## Consequences

### Positive
- Defensibility to accreditation auditors: every state transition has a human decision trail.
- Auditor primacy preserved; tool is "backseat navigator."
- Liability bounded.

### Negative
- Some auditor friction (every promotion is a click). UX work invests in low-friction confirm patterns.
- Engine quality matters: noisy candidates erode auditor trust faster than missed candidates.

### Neutral
- Dismissals are captured as negative training signal but never as authority on the underlying claim.

## Alternatives Considered

| Option | Why rejected |
|---|---|
| Auto-promote high-confidence candidates | Even one wrong auto-promote breaks auditor trust and creates a regulatory issue. |
| Engine concludes conformity with override | Encourages skipping the human decision. Inverts ISO 17021-1 model. |

## Compliance Implications

ISO 17021-1 9.4 (audit conclusions are auditor judgments); EU AI Act Art. 14 (human oversight as a baseline requirement for high-risk AI).

## Follow-Ups

- [ ] UI affordances for bulk-confirm with full provenance.
- [ ] Periodic "auditor calibration" review of accept/reject rates.
