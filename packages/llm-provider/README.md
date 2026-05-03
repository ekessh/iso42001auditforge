# @auditforge/llm-provider

Provider abstraction in front of every LLM call AuditForge makes.

License: BUSL-1.1.

## Providers

- `OllamaProvider` — local Ollama (default).
- `VllmProvider` — local vLLM (OpenAI-compatible).
- `LlamaCppProvider` — local llama.cpp server with grammar-constrained
  decoding.
- `AnthropicProvider` — cloud, via `@anthropic-ai/sdk`. Uses extended thinking
  for `reasonStructured`.
- `OpenAIProvider` — cloud, via `openai`. Uses o-series reasoning models for
  `reasonStructured`.

## Cross-cutting

- `TierRouter` — maps logical tasks (`claim_extraction`,
  `attribution_rerank`, etc.) to a tier (`small | medium | large | reasoning`)
  and a concrete provider+model. Air-gap mode disables every cloud entry.
- `InvocationLedger` — every call writes to `llm_invocations` with provider,
  model name + hash + version, temperature, prompt template version, token
  counts, latency, cost, optional reasoning trace, and the eventual auditor
  accept/reject decision.
- `CostController` — per-engagement budget cap, warn-at-80%, hard-fallback at
  100% to local.
- `ConsentGuard` — cloud calls require an active `consentRecordId`. Air-gap
  mode short-circuits.
- `PromptTemplateRegistry` — versioned templates, hashed; required on every
  call.

## Background

- ADR 0011: LLM provider abstraction.
- v3.md §26.2 for full design.
