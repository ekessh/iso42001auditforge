# ADR-0024: Tier router for LLM provider abstraction

- **Status**: Accepted (refines ADR-0011)
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, conversational engine lead
- **Phase**: 7.5 (LLM provider abstraction)
- **Tags**: llm, routing, cost, observability

## Context

ADR-0011 established the LLM Provider Abstraction with four tiers
(small / medium / large / reasoning). What it did *not* settle was the
*selection algorithm* — given a call site (`questionGenerator.draft`,
`reranker.rank`, `ncDrafter.synthesize`, ...), which tier is chosen, and
on what evidence?

A naive "every call site declares its tier statically" approach is
brittle: prompt engineers want to A/B-test routing decisions, and an
engagement in air-gap mode (ADR-0025) needs to fall back from cloud-only
"reasoning" to local "large" without code changes.

## Decision

Implement an explicit **Tier Router** in `packages/llm-provider/src/router.ts`:

```ts
interface TierRoute {
  callSite: string;              // e.g. 'questionGenerator.draft'
  defaultTier: Tier;             // small | medium | large | reasoning
  preferLocal: boolean;          // air-gap and consent considerations
  fallbackTiers: Tier[];         // ordered fallbacks if primary unavailable
  budgetCapUSD?: number;         // cost cap per invocation
  maxLatencyMs?: number;         // soft latency budget
}

const route = router.resolve('questionGenerator.draft', engagement);
const provider = route.provider;
const result = await provider.reasonStructured(prompt, schema, opts);
```

Routes live in a typed configuration loaded at engagement-creation time,
versioned in the ledger (so a change in routing is itself an audit event)
and overridable per engagement by the auditor (with consent capture if
the override expands the cloud surface). The router consults:

1. **Engagement air-gap mode**: if true, only local providers are
   eligible.
2. **Engagement cloud-consent set**: only providers in the consent set
   are eligible.
3. **Per-call-site default tier**: from the routing config.
4. **Provider availability**: a hot ping cache marks unavailable providers.
5. **Budget cap**: estimated input+output tokens × provider rate; the
   router rejects with a typed `BudgetExceededError` rather than fall
   back to a cheaper model that would degrade quality silently.
6. **Latency budget**: providers tag themselves with a p95 latency
   profile; the router prefers the cheapest provider whose p95 fits.

Every routing decision is logged to `llm_invocations.routing_trace` so
peer reviewers can replay the decision.

## Consequences

### Positive

- **One choke point** for cost, latency, consent, air-gap, and provider
  availability — no scattered `if (engagement.cloudOk) { ... }` checks.
- **A/B testable.** Routing config is data, not code; experimenting
  with "use medium tier for re-ranker on engagements > 50 clauses"
  needs a config change, not a deploy.
- **Auditable.** The routing trace makes it possible to answer
  retrospectively: *which model produced this candidate finding?*

### Negative

- **One more failure mode.** A misconfigured route can starve a
  call site of providers; we mitigate with a CI test that resolves
  every known call site against a default routing config and asserts a
  provider is selected.
- **Cost estimation precision.** Token counts before the call are
  estimates, not exact; budget cap is best-effort.

### Neutral

- The router does not implement learned routing (no bandit, no
  reward model). That is a Phase 16 follow-up under "Continuous Engine
  Improvement Loop".

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Static tier per call site | No air-gap fallback without redeploy; not testable. |
| Single-provider monolith | Defeats the point of the abstraction. |
| Learned routing (bandit) | Premature; needs a reward model and offline data. |
| Provider-side fallback (e.g. OpenRouter) | Loses our consent-and-air-gap controls. |

## Compliance Implications

- **ISO 42001 Clause 7.4.3** (transparency): the routing trace is a
  transparent record of "which AI system did what" — required by the
  AI System Inventory dogfooding rule.
- **EU AI Act Art. 13** (transparency to users): for cloud-routed
  invocations the auditor sees the provider name in the suggestion
  panel, satisfying user-facing transparency.

## Follow-Ups

- [ ] Phase 8: provider parity probe — the same prompt run against
      every provider in the same tier produces structurally similar
      results (semantic equivalence, not token-equivalence).
- [ ] Phase 16: learned routing — bandit over the routing trace dataset.
- [ ] Wave-3: load test `load/llm-tier-routing.js` validates router
      under bursty traffic.
