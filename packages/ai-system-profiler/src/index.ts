// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/ai-system-profiler — public surface barrel.
 *
 * Re-exports the existing public modules so that `import ... from
 * '@auditforge/ai-system-profiler'` resolves the workspace `main` path
 * declared in package.json.
 *
 * Phase 2 of the AuditForge ISO 42001 build (AI System intake, profiling,
 * data-flow mapping, risk classification + pluggable importers).
 */

// Domain types — single source of truth for AI system / profile / risk.
export * from './types/index.js';
