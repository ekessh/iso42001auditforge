// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/report-engine — public surface barrel.
 *
 * Re-exports the public modules of the report engine so that
 * `import ... from '@auditforge/report-engine'` resolves the workspace
 * `main` path declared in package.json.
 *
 * Sub-path exports (`./templates`, `./renderers`, `./signing`, etc.) are
 * declared in package.json `exports` and remain the recommended import
 * path for tree-shaking; the root barrel exists for ergonomic top-level
 * usage.
 */

// Top-level domain + errors.
export * from './domain.js';
export * from './errors.js';

// Public sub-modules with stable barrels.
export * from './templates/index.js';
export * from './renderers/index.js';
export * from './branding/index.js';
export * from './substitution/index.js';
