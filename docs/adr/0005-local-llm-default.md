# ADR-0005: Local-LLM (Ollama) Default; Cloud LLM Opt-In Per Engagement

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0, 5, 13
- **Tags**: privacy, ai, security

## Context

Audit data is highly sensitive — auditee trade secrets, model weights, training-data summaries, incident logs. Sending it to a cloud LLM provider, even a privacy-respecting one, may violate auditee NDAs and erodes auditor independence claims.

## Decision

The AI Co-Auditor and probe-evaluation tasks run against a local Ollama instance by default. Models pulled at install time. The cloud LLM backend (Anthropic / OpenAI) is **opt-in per engagement** with two-sided consent: the lead auditor enables it, and the auditee accepts a written disclosure that lists data categories that may be transmitted.

Every cloud-LLM call carries a logged consent reference and is recorded in the audit ledger as an "AI-assisted, auditor-confirmed" event.

A PII scrubber runs ahead of any cloud call by default (commercial-tier feature).

Air-gapped deployments cannot enable cloud LLM at all.

## Consequences

### Positive
- Privacy-by-default; the auditor doesn't have to remember to opt out.
- Confidential engagements work without external dependencies.

### Negative
- Local model quality < frontier cloud models for some tasks.
- More install effort (pulling models, GPU requirements for vLLM).

### Neutral
- The same prompt contracts work against both backends; we test parity.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Cloud-only | Confidentiality risk too high for default. |
| Local-only | Forfeits cloud quality where consented use is fine. |
| BYO API key UI | Quietly leaks data unless gated by consent flow. |

## Compliance Implications

ISO 42001 A.5, A.9; GDPR Art. 28/32; auditee contracts.

## Follow-Ups

- [ ] Default model list per task (suggester, drafter, summariser).
- [ ] Consent flow UX + ledger event schema.
- [ ] Backend parity test suite.
