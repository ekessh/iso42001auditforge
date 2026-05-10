# @auditforge/qa-checklist

Pre-publication quality gate enforced before any AuditForge signed report
artifact may be published.

The runner accepts a `ReportPublicationContext` snapshot (drafts, evidence
links, peer-review state, candidate-finding state, sampling-plan, signing
material, TSA anchor, engagement mode) and returns a deterministic
`{ passed, items: [...] }` result. A failed item blocks publication. Lead
auditors may explicitly override a failed item with a rationale; the runner
re-emits a `qa_checklist.overridden` ledger event.

This package has zero IO — it only computes results from the snapshot the
caller provides. Wiring to `@auditforge/report-engine`,
`@auditforge/peer-review`, `@auditforge/audit-engine`, and
`@auditforge/coverage-tracker` happens in `apps/api`.
