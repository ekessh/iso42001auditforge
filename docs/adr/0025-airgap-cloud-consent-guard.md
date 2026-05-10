# ADR-0025: Air-gap mode and cloud-consent guard at the provider layer

- **Status**: Accepted (refines ADR-0011, ADR-0024)
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, security review, compliance review
- **Phase**: 7.5 (LLM provider abstraction)
- **Tags**: privacy, consent, network-isolation, llm, security

## Context

`CLAUDE.md` requires "Local default; cloud LLM opt-in per engagement,
auditee written consent required, air-gap mode disables cloud at provider
layer." The wording is exact: cloud must be disabled **at the provider
layer**, not just hidden in the UI. A misconfigured route, a developer
flag, or a forgotten environment variable cannot leak the auditee's
working papers to a cloud LLM.

We had to choose where exactly that guard lives, and what its failure
mode looks like.

## Decision

Implement two layered guards inside `packages/llm-provider`:

1. **Air-gap guard** at the provider factory. The factory reads
   `engagement.airGapMode` at construction time and refuses to instantiate
   any cloud provider (Anthropic, OpenAI) when air-gap is true. The
   provider list is pruned **before** the router (ADR-0024) sees it; the
   router cannot bypass air-gap by selecting a provider that does not
   exist.
2. **Cloud-consent guard** at the same factory. Even with air-gap off,
   instantiating a cloud provider requires the engagement's
   `cloudConsent` set to include that specific provider id. The consent
   set is mirrored from `consent_registry` rows that carry an auditee
   signature and a date. No signature, no provider.

Both guards are also enforced by the **invocation hook**: every
`reasonStructured()` call passes through a single `guardedInvoke()`
wrapper which re-checks
`(engagement.airGapMode, engagement.cloudConsent)` and the resolved
provider's `isCloud` flag. This is intentionally redundant — if the
factory check were ever bypassed (a dev shortcut, a forgotten test
helper), the invocation hook still fails.

A cloud invocation under air-gap or without consent throws
`AirGapViolationError` / `CloudConsentMissingError`; both errors are
caught by the API layer and surfaced as `403 Forbidden` with a body
that names the engagement, the requested provider, and the missing
consent line.

A `CI` probe (`tests/security/airgap-isolation.spec.ts`) drives a
synthetic engagement with `airGapMode=true` and asserts that
*every* call site (enumerated from the call-site registry) refuses to
hit a cloud provider, with no network egress observed.

## Consequences

### Positive

- **Belt-and-braces.** Both factory and invocation-time checks must fail
  for a leak to occur.
- **Network-egress test in CI.** The probe runs in a sandbox with
  outbound HTTP blocked except to localhost; an attempted egress is a
  test failure, not a runtime warning.
- **Auditable consent.** The consent line is carried into every
  `llm_invocations` row so peer reviewers can confirm consent for every
  cloud call.

### Negative

- **No network kill-switch in the OS.** Air-gap is enforced in code;
  a malicious dependency could in principle bypass it. We mitigate
  with the egress probe and with `Trivy` / OSV-scanner running on the
  full dep tree per security workflow.

### Neutral

- We considered making the guard a separate **proxy** process that all
  LLM traffic passes through. Operationally heavier; a future ADR may
  revisit if regulators ask for "physically separate enforcement".

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| UI flag only | Trivially bypassed by a code path that does not check the flag. |
| OS-level firewall | Outside our control on customer-managed deploys. |
| Network policy in K8s | Helps but does not work for desktop / on-prem deploys. |
| Single check at the API edge | Bypassed by any internal worker that imports the provider directly. |

## Compliance Implications

- **EU AI Act Art. 10** (data and data governance): no auditee data
  leaves the air-gapped boundary without explicit consent.
- **ISO 27001 A.13.2** (information transfer): cross-boundary transfers
  are documented (consent_registry) and revocable.
- **ISO 42001 Clause 7.5.3** (control of documented information): the
  consent log is itself documented and retrievable.
- **GDPR Art. 28** (processor obligations) and **Art. 44** (transfers):
  the consent line + provider name + region tag together satisfy the
  cross-border-transfer disclosure obligation when a cloud provider
  is used.

## Follow-Ups

- [ ] Wave-3: `tests/security/airgap-isolation.spec.ts` runs in
      `nightly.yml` under a sandbox with outbound HTTP blocked.
- [ ] Phase 14: consent revocation flow — revocation invalidates
      future invocations but preserves prior `llm_invocations` rows.
- [ ] Phase 14: regional pinning (e.g. "cloud OK but only EU
      providers") layered on top of the consent guard.
