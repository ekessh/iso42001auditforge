# @auditforge/interview-library

Curated, role-indexed interview-question catalogue used by AuditForge live
interview mode (Section 3.10 / Phase 10). Distinct from
`@auditforge/conversational-engine` `question-library` — that one drives the
generic conversational engine; this one is targeted at the auditor's
prepared-interview workflow.

Data is JSON under `src/data/interview-library.json`. The loader validates
every entry against Zod, indexes them by role/clause/applicable-mode, and the
composer builds a time-boxed interview plan ranked by clause coverage and
auditor focus.

The hybrid-search index produced by `IndexableEntry[]` from the loader is
push-only — `packages/search` consumes it. This package never speaks to a DB.
