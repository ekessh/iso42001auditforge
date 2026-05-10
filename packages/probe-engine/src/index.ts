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

// External (Python sidecar) audit-evidence runner.
export {
  ExternalAuditEvidenceRunner,
  ExternalAuditEvidenceRunnerError,
  type ExternalRunnerOptions,
  type ExternalRunnerStartArgs,
  type ExternalRunnerStreamEvent,
  type ExternalTarget,
  type ExternalBudget,
  type ExternalSandbox,
  type ExternalCatalogueEntry,
  type ExternalCheckResult,
  type ExternalRunStatus,
  type ExternalFinding,
  type ExternalMetrics,
  type ExternalCheckOutcome,
  type ExternalRunState,
  type ExternalSeverity,
  type ExternalArtifactRef,
} from './external-runner.js';

export {
  STANDARD_EVIDENCE_PACK,
  buildStandardEvidencePack,
  type StandardEvidencePackEntry,
  type StandardEvidencePackOptions,
  type StandardEvidenceParams,
} from './checks/standard-evidence-pack.js';

export {
  MCP_CONFORMANCE_CATALOGUE,
  buildMcpConformancePack,
  buildPMcp01,
  buildPMcp02,
  buildPMcp03,
  buildPMcp04,
  buildPMcp05,
  buildPMcp06,
  buildPMcp07,
  buildPMcp08,
  P_MCP_01_META as P_MCP_01_CONFORMANCE_META,
  P_MCP_02_META as P_MCP_02_CONFORMANCE_META,
  P_MCP_03_META as P_MCP_03_CONFORMANCE_META,
  P_MCP_04_META as P_MCP_04_CONFORMANCE_META,
  P_MCP_05_META as P_MCP_05_CONFORMANCE_META,
  P_MCP_06_META as P_MCP_06_CONFORMANCE_META,
  P_MCP_07_META as P_MCP_07_CONFORMANCE_META,
  P_MCP_08_META as P_MCP_08_CONFORMANCE_META,
  type McpConformanceEntry,
  type McpConformanceAdapterOptions,
  type McpConformanceParams,
} from './checks/mcp-conformance/index.js';
