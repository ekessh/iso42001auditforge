# ADR-0011: LLM Provider Abstraction with Tiered Routing and Per-Invocation Ledger

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 7.5
- **Tags**: llm, provider, audit-integrity

## Context

v2 already chose local-default + cloud-opt-in. v3 hardens this into a typed provider abstraction so the engine can route by task tier (small / medium / large / reasoning) and the audit ledger can prove which model produced which suggestion at which point in time.

## Decision

A single `LLMProvider` interface with `complete`, `embed`, `classifyStructured<T>`, `reasonStructured<T>`, `metadata`. Implementations: `OllamaProvider`, `VllmProvider`, `LlamaCppProvider`, `AnthropicProvider`, `OpenAIProvider`.

A tier router maps tasks to tiers:

| Task | Tier | Local | Cloud equivalent |
|---|---|---|---|
| Claim extraction, embedding | Small | Llama 3.1 8B / BGE-M3 | Haiku, text-embedding-3-large |
| Attribution re-rank, NC drafting, contextualization | Medium | Qwen 2.5 32B / Llama 3.3 70B Q4 | Sonnet |
| Long-context synthesis (rare) | Large | Qwen3-30B-A3B / MiniMax-M1 | Opus |
| High-stakes attribution with CoT | Reasoning | DeepSeek-R1, Qwen3-Next-Thinking, gpt-oss-120B | Claude extended thinking, OpenAI o-series |

Per-engagement override is allowed; air-gapped deployments disable cloud providers at the abstraction layer.

`llm_invocations` records every call: provider, model name, model hash (local) or version string (cloud), temperature, prompt template version, input and output token counts, latency, cost, and the auditor's eventual accept/reject decision. `reasonStructured` additionally writes `reasoning_trace`.

## Consequences

### Positive
- The audit file proves which model said what; defensible to accreditation auditors.
- Provider switching does not invalidate prior auditor decisions (decisions are model-independent at the audit-record level).
- Cost caps are a top-level control; overrun triggers automatic local fallback.
- Reasoning traces give "why this attribution" disclosure to auditors and external reviewers.

### Negative
- Per-call ledger overhead.
- Multi-provider parity testing is required per release.

### Neutral
- The interface is small. Adding a new provider is a half-day.

## Alternatives Considered

| Option | Why rejected |
|---|---|
| Hard-coded calls to one SDK | Locks the audit defensibility story to one vendor. |
| Direct LangChain/LlamaIndex | Too much surface area; obscures invocation logging. |
| Per-call shell out to a CLI | Latency + audit-trail integrity hard. |

## Compliance Implications

ISO 17021-1 evidence integrity (model attribution); GDPR Art. 28 (subprocessors when cloud opted-in); EU AI Act Art. 13 (transparency about which AI produced which output).

## Follow-Ups

- [ ] Provider parity test suite.
- [ ] Cost-cap UX (preview before high-volume operations).
- [ ] Reasoning-trace storage cost analysis.
