# AuditForge ISO 42001 — Design Spec

The canonical, full design specification is the document originally delivered as
`auditforge.md` (gitignored — present in the workspace, not committed). This
file restates the load-bearing pieces for contributors who do not have access
to the original.

If you need the full text, request it from the maintainer team.

## Mission

Workbench for ISO/IEC 42001 Lead Auditors to plan, execute, document, and
report AI Management System (AIMS) audits — including deep technical assessment
of AI Models, AI Agents, and Agentic AI Workflows.

## Phasing

- Phase 0 — Foundations
- Phase 1 — Identity, Tenancy, Reference Catalogues
- Phase 2 — AI System Profiler & Auditee Onboarding
- Phase 3 — Engagement, Programme, Plan Builder
- Phase 4 — Working Papers, Evidence, Offline Sync
- Phase 5 — Technical AI Assessment Runner (Probe Engine)
- Phase 6 — Agentic Workflow Auditor
- Phase 7 — Findings, NC & CAPA
- Phase 8 — SoA, Risk Review, Cross-Framework
- Phase 9 — Report Engine
- Phase 10 — Sampling, Interviews, Time & Billing
- Phase 11 — Continuous Surveillance
- Phase 12 — Peer Review, Quality, Archive
- Phase 13 — AI Co-Auditor
- Phase 14 — Hardening, Compliance, Launch

## Non-Negotiable Constraints

- Clean-room implementation. No VerifyWise source read.
- Open-core: `core/**` Apache-2.0; `commercial/**` proprietary EULA.
- Tenant isolation enforced both in app layer and at Postgres RLS layer.
- All audit-state changes flow through a signed, hash-chained event ledger.
- Working papers are offline-first (CRDT).
- Local-LLM (Ollama) is the default AI backend for AI Co-Auditor + probe
  evaluation; cloud LLM opt-in per engagement.
- Reports are signed with hardware-backed keys (WebAuthn / passkey / PKCS#11)
  and frozen with TSA timestamps for long-term verification.
- Cross-framework views (ISO 42001 ↔ EU AI Act ↔ NIST AI RMF) are first-class.

## Stack Summary

TypeScript end-to-end. Next.js 15 (web), Tauri 2 (desktop), PWA (mobile),
NestJS modular monolith (api), BullMQ workers, Drizzle ORM, Postgres 16 with
pgvector + RLS, Redis 7, MinIO/S3, Meilisearch, Yjs CRDT, Auth.js + WebAuthn,
Anthropic + OpenAI SDKs, Ollama, Vitest + Playwright + k6.

For the unabridged spec — including the full module list, data model, control
catalogues, probe catalogue, and Section 11 build conventions — see the
maintainer-controlled design document.
