// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/interviews — public surface barrel.
 *
 * Re-exports the available domain modules so that
 * `import ... from '@auditforge/interviews'` resolves the workspace
 * `main` path declared in package.json.
 *
 * Only `./domain/question` is currently implemented; session, note, and
 * action-item modules referenced by the existing `./domain/index.ts`
 * barrel land in a later phase. The root barrel deliberately imports the
 * leaf module directly to avoid pulling the broken sub-barrel into the
 * dependency graph.
 */

// Question library types + schema (Phase 10 / Section 3.10).
export * from './domain/question.js';
