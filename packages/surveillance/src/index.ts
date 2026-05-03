// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/surveillance — Phase 11, Section 3.11.
 *
 * Continuous surveillance for ISO 42001 certification:
 *  - Hardened telemetry ingest (signed, replay-protected, schema-validated, rate-limited)
 *  - Threshold alerting with hysteresis
 *  - Risk re-scoring engine
 *  - Surveillance scope adjustment
 *  - Incident watch (A.5.5)
 */

export * from './domain.js';
export * from './signing.js';
export * from './rate-limit.js';
export * from './telemetry-ingest.js';
export * from './threshold-evaluator.js';
export * from './alert-dispatcher.js';
export * from './risk-score-engine.js';
export * from './scope-adjuster.js';
export * from './incident-watch.js';
