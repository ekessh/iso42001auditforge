// SPDX-License-Identifier: BUSL-1.1
//
// Barrel export for API adapter modules. Each adapter is a thin shim over a
// `@auditforge/*` workspace package so the API never reaches into a
// package's internals directly.
//
// Phase-1 (already wired):
//   - `AuditEngineAdapter`    -> @auditforge/audit-engine
//   - `TenancyAdapter`        -> @auditforge/tenancy-core
//   - `WorkingPapersAdapter`  -> @auditforge/working-papers
//   - `FindingsAdapter`       -> @auditforge/findings (+ @auditforge/capa)
//   - `EvidenceVaultAdapter`  -> @auditforge/evidence-vault
//   - `ProbesAdapter`         -> @auditforge/probe-engine
//   - `*` from `auth-core.adapter`
//
// Phase-2 (this pass — workspace-deps wiring):
//   - `EngagementAdapter`     -> @auditforge/engagement
//   - `CapaAdapter`           -> @auditforge/capa
//   - `ArchiveAdapter`        -> @auditforge/archive
//   - `SoaAdapter`            -> @auditforge/soa
//   - `SamplingAdapter`       -> @auditforge/sampling
//   - `CoAuditorAdapter`      -> @auditforge/co-auditor
//   - `CrossFrameworkAdapter` -> @auditforge/cross-framework
//   - `RisksAdapter`          -> @auditforge/risks
//   - `TraceAnalyzerAdapter`  -> @auditforge/trace-analyzer (traces +
//                                 agent-workflows)
//   - `AiSystemsAdapter`      -> @auditforge/ai-system-profiler
//   - `AuditPlansAdapter`     -> @auditforge/engagement (plan + receipt)
//   - `InterviewsAdapter`     -> @auditforge/interviews
//   - `BillingAdapter`        -> @auditforge/billing
//   - `PeerReviewAdapter`     -> @auditforge/peer-review
//   - `SurveillanceAdapter`   -> @auditforge/surveillance

export * from './audit-engine.adapter.js';
export * from './auth-core.adapter.js';
export * from './tenancy.adapter.js';
export * from './working-papers.adapter.js';
export * from './findings.adapter.js';
export * from './evidence-vault.adapter.js';
export * from './probes.adapter.js';

// Phase-2 adapters.
export * from './engagement.adapter.js';
export * from './capa.adapter.js';
export * from './archive.adapter.js';
export * from './soa.adapter.js';
export * from './sampling.adapter.js';
export * from './co-auditor.adapter.js';
export * from './cross-framework.adapter.js';
export * from './risks.adapter.js';
export * from './trace-analyzer.adapter.js';
export * from './ai-systems.adapter.js';
export * from './audit-plans.adapter.js';
export * from './interviews.adapter.js';
export * from './billing.adapter.js';
export * from './peer-review.adapter.js';
export * from './surveillance.adapter.js';
