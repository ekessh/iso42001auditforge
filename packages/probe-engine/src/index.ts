// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/probe-engine — public surface barrel.
 *
 * Re-exports the public modules of the probe engine so that
 * `import ... from '@auditforge/probe-engine'` resolves the workspace
 * `main` path declared in package.json.
 *
 * `ProbeExecution` is re-exported by both `./types.js` (its origin) and
 * `./dsl.js`; the barrel sources it from `./types.js` only and pulls
 * the rest of `./dsl.js` via a named-export list to avoid ambiguous
 * star-export merges.
 */

// Core types — single source of truth for ProbeExecution and friends.
export * from './types.js';

// Probe DSL (named to avoid duplicate re-export of ProbeExecution).
export {
  type ProbeRunContext,
  type InferenceClient,
  type InferenceRequest,
  type InferenceResponse,
  type ImageClassificationInput,
  type ClassificationResponse,
  type ProbeRunResult,
  type ProbeDefinition,
  type AnyProbeDefinition,
  type ProbePin,
  defineProbe,
  asAnyProbe,
  isProbeRunResult,
} from './dsl.js';

// Hash + RNG utilities.
export * from './hash.js';
export * from './rng.js';

// Engine subsystems.
export * from './runner.js';
export * from './sandbox.js';
export * from './test-set-manager.js';
export * from './budget-controller.js';
export * from './wp-linker.js';
