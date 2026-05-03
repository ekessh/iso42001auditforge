// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/llm-cloud — minimal barrel stub.
 *
 * Phase 7.5 placeholder. The cloud-LLM backend (opt-in only — Anthropic +
 * OpenAI adapters with prompt caching, cost tracking, PII scrubber pre-call
 * hook, output classifier post-call hook, and per-engagement consent
 * enforcement) is not yet implemented in this package.
 *
 * The provider implementations themselves live in
 * `@auditforge/llm-provider`. This package will host the cloud-only
 * concerns (consent gating, cost ledger, cache routing) once Phase 7.5
 * lands.
 *
 * TODO(phase-7.5): integrate with @auditforge/llm-provider
 * AnthropicProvider/OpenAIProvider. Until then the package exposes only
 * an empty barrel so workspace consumers can resolve the package without
 * a build error. Do not implement LLM cloud logic here — that lives in
 * `@auditforge/llm-provider`.
 *
 * Sub-paths declared in package.json `exports`
 * (`./types`, `./consent`, `./hooks`, `./cost`, `./anthropic`, `./openai`,
 * `./factory`) point at modules that have not been written yet; importing
 * them will fail until Phase 7.5 lands. The package.json declarations are
 * preserved as the contract surface they will fulfil.
 */

/**
 * Sentinel marker exported so `import {} from '@auditforge/llm-cloud'`
 * resolves to a valid module rather than an empty file. Consumers should
 * not depend on this constant — it is removed once real cloud-provider
 * factories land in Phase 7.5.
 */
export const __LLM_CLOUD_PHASE_7_5_PLACEHOLDER__ = true;
