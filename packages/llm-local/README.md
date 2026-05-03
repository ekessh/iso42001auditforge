# @auditforge/llm-local

Local-LLM backend for AuditForge ISO 42001. Default LLM transport per **ADR-0005** —
confidential audit data never leaves the engagement environment unless the auditor and
client jointly opt in to a cloud backend (handled by `@auditforge/llm-cloud`).

License: **BUSL-1.1** (see `LICENSE` at repo root).

## Adapters

| Adapter | Status   | Notes |
|---------|----------|-------|
| Ollama  | Default  | HTTP REST API on `http://127.0.0.1:11434` |
| vLLM    | Optional | OpenAI-compatible REST API |

Both adapters expose the same `LocalLlmAdapter` interface so the AI Co-Auditor can
swap them transparently.

## API

```ts
import { createLocalLlm } from '@auditforge/llm-local';

const llm = createLocalLlm({ kind: 'ollama', baseUrl: 'http://127.0.0.1:11434' });

await llm.health();                              // server reachable + at least one model
await llm.listModels();                          // available models
await llm.pullModel('llama3.1:8b-instruct');     // install-time helper

const out = await llm.generate('llama3.1:8b-instruct', 'Summarize ISO 42001 5.2', {
  temperature: 0.2,
  maxTokens: 512,
});

for await (const chunk of llm.generateStream('llama3.1:8b-instruct', 'Hello')) {
  process.stdout.write(chunk.text);
}

await llm.chat('llama3.1:8b-instruct', [
  { role: 'system', content: 'You are an ISO 42001 lead auditor.' },
  { role: 'user',   content: 'Draft an NC for an unmanaged training-data lineage gap.' },
]);

const vec = await llm.embed('nomic-embed-text', 'Working paper WP-2025-031.');
```

## Reliability

- Connection refused → bounded exponential backoff retry (configurable, default 3 attempts).
- HTTP errors with status codes are mapped to typed `LocalLlmError` subclasses.
- Streaming uses NDJSON parsing per Ollama spec; partial frames are buffered until newline.
- Non-streaming `generate`/`chat` aggregate stream chunks when `stream` defaults `true` upstream.

## Testing

```sh
pnpm --filter @auditforge/llm-local test
```

Tests use `vi.fn()` to mock `fetch`; no live Ollama process is required in CI.
