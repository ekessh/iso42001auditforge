# @auditforge/llm-cloud

Cloud-LLM backend for AuditForge ISO 42001. Per **ADR-0005**, the cloud backend is
**opt-in only**. The local backend (`@auditforge/llm-local`) is the default and the
cloud backend MUST NOT be invoked without an active per-engagement consent record.

License: **BUSL-1.1** (see `LICENSE` at repo root).

## Adapters

| Adapter   | Vendor          | Notes |
|-----------|-----------------|-------|
| Anthropic | Claude API      | Uses `cache_control: { type: 'ephemeral' }` for prompt caching |
| OpenAI    | OpenAI API      | Prompt caching is automatic for prompts ≥1024 tokens |

Both adapters expose the same `CloudLlmAdapter` interface (a strict superset of
`LocalLlmAdapter`).

## Required guards

Every call requires a `CallContext`:

```ts
import { createCloudLlm } from '@auditforge/llm-cloud';

const llm = createCloudLlm({
  kind: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  consentStore,             // implements ConsentStore
  costTracker,              // implements CostTracker
  piiScrubber,              // optional PiiScrubber pre-call hook (default: no-op)
  outputClassifier,         // optional OutputClassifier post-call hook (default: no-op)
});

await llm.chat(
  'claude-opus-4-5',
  [{ role: 'user', content: 'Summarize evidence batch 12.' }],
  {},
  { engagementId, consentRecordId, auditorId },   // ← required
);
```

A missing or expired consent record throws `CloudConsentRequiredError`. PII is scrubbed
**before** any payload leaves the process. Output classifiers can refuse to surface model
output flagged as containing client-data exfiltration patterns; refused outputs are
returned as `RefusedResponse` and still ledger-logged by callers.

## Cost tracking

Every call emits a `CostRecord` to the configured `CostTracker`. The default
`InMemoryCostTracker` aggregates per engagement/auditor/model.

## Testing

```sh
pnpm --filter @auditforge/llm-cloud test
```

Tests use `vi.fn()` to mock SDK HTTP calls; no live API keys are required.
