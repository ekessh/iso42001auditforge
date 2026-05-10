<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: developer, operator
adr: 0011, 0024
cross-refs:
  - docs/adr/0011-llm-provider-abstraction.md
  - docs/adr/0024-tier-router-llm-provider.md
  - packages/llm-provider/
-->

# Tier Router

> This document explains how the LLM provider abstraction routes
> inference tasks to the appropriate model tier.

---

## Tiers

| Tier | Tasks | Local default | Cloud equivalent |
|---|---|---|---|
| **Small** | Claim extraction, embedding, schema validation | Llama 3.1 8B / BGE-M3 | Claude Haiku, text-embedding-3-large |
| **Medium** | Attribution re-rank, NC drafting, contextualization, follow-up generation | Qwen 2.5 32B / Llama 3.3 70B Q4 | Claude Sonnet |
| **Large** | Long-context synthesis (rare; only for multi-document cross-engagement synthesis) | Qwen3-30B-A3B / MiniMax-M1 | Claude Opus |
| **Reasoning** | High-stakes attribution with CoT capture, complex multi-hop reasoning | DeepSeek-R1, Qwen3-Next-Thinking | Claude extended thinking, OpenAI o-series |

---

## Routing Logic

The tier router is in `packages/llm-provider/src/tier-router.ts`.
Routing decisions:

1. **Task type** maps to a tier (hard-coded in the router).
2. **Per-engagement override** — the lead auditor can override the tier
   for specific task types via the engagement LLM settings.
3. **Availability check** — if the preferred local model is not
   available (Ollama pod not ready, GPU memory exhausted), the router
   falls back to the next available local model in the tier.
4. **Cloud consent check** — if local models are unavailable and cloud
   LLM is opted-in, the router routes to the cloud equivalent.
5. **Cost cap check** — if the engagement budget is exhausted, the
   router forces local even if cloud is opted-in.
6. **Air-gap guard** — if air-gap mode is enabled, cloud is never
   selected.

---

## Provider Interface

Every provider implements `LLMProvider`:

```typescript
interface LLMProvider {
  complete(prompt: string, opts: CompletionOpts): Promise<string>;
  embed(text: string): Promise<number[]>;
  classifyStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;
  reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: ReasoningOpts
  ): Promise<{ result: T; reasoningTrace: string }>;
  metadata(): ProviderMetadata;
}
```

`reasonStructured` captures the full chain-of-thought trace. The trace
is stored in `llm_invocations.reasoning_trace` and is visible to the
auditor in the attribution provenance panel.

---

## Per-Invocation Logging

Every inference call is logged to `llm_invocations`:

| Field | Value |
|---|---|
| `provider` | e.g. `ollama`, `anthropic` |
| `model_name` | e.g. `qwen2.5:32b`, `claude-sonnet-4-6` |
| `model_hash` | SHA-256 of the model weights (local) or model version string (cloud) |
| `tier` | `small`, `medium`, `large`, `reasoning` |
| `temperature` | Float |
| `prompt_template_version` | Version of the prompt template used |
| `input_tokens` | Count |
| `output_tokens` | Count |
| `latency_ms` | Wall time |
| `cost_usd` | Computed cost (local: 0; cloud: token × rate) |
| `auditor_decision` | `accepted` / `rejected` / `pending` — set when the auditor acts on the output |
| `reasoning_trace` | Full CoT trace (reasoning tier only) |

This log is the basis for AI transparency disclosure under EU AI Act
Art. 13 and GDPR Art. 22 explainability requirements.

---

## Adding a New Provider

Implement the `LLMProvider` interface and register in the provider
registry:

```typescript
// packages/llm-provider/src/providers/my-provider.ts
// SPDX-License-Identifier: BUSL-1.1
export class MyProvider implements LLMProvider { ... }

// packages/llm-provider/src/provider-registry.ts
registry.register('my-provider', MyProvider);
```

Add provider parity tests (CI gate requirement per CLAUDE.md) in
`packages/llm-provider/src/parity-tests/`.

---

## Cross-References

- [ADR-0011](../adr/0011-llm-provider-abstraction.md) — abstraction
  design.
- [ADR-0024](../adr/0024-tier-router-llm-provider.md) — routing
  decisions.
- [consent-and-air-gap.md](consent-and-air-gap.md) — cloud consent.
- `packages/llm-provider/src/` — source code.
