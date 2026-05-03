// SPDX-License-Identifier: BUSL-1.1
//
// Barrel export for API adapter modules. Each adapter is a thin shim over a
// `@auditforge/*` workspace package so the API never reaches into a
// package's internals directly.
//
// New adapters added in the workspace-deps wiring pass:
//   - `AuditEngineAdapter`    -> @auditforge/audit-engine
//   - `TenancyAdapter`        -> @auditforge/tenancy-core
//   - `WorkingPapersAdapter`  -> @auditforge/working-papers
//   - `FindingsAdapter`       -> @auditforge/findings (+ @auditforge/capa)
//   - `EvidenceVaultAdapter`  -> @auditforge/evidence-vault
//   - `ProbesAdapter`         -> @auditforge/probe-engine

export * from './audit-engine.adapter.js';
export * from './auth-core.adapter.js';
export * from './tenancy.adapter.js';
export * from './working-papers.adapter.js';
export * from './findings.adapter.js';
export * from './evidence-vault.adapter.js';
export * from './probes.adapter.js';
