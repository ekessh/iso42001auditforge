# Wave-3 Security Review — Process & Quality

<!-- SPDX-License-Identifier: BUSL-1.1 -->

- **Date**: 2026-05-10
- **Scope**: ADRs 0017-0027, threat-model/*, e2e tests, load tests,
  Semgrep custom rules, CI workflow updates.
- **Reviewer**: AuditForge security review (placeholder — sign-off at
  PR merge).

## Summary

Wave-3 is process and quality work; no production code paths changed.
Security-relevant deliverables:

1. **ADRs**: documented previously-undocumented decisions from Wave 1-2,
   including the two security-debt items (ADR-0018 auth interim,
   ADR-0027 CSP interim) so subsequent reviews start from a known state.
2. **Threat model**: STRIDE/DREAD/mitigation-tracker artefacts created
   for the first time. They make residual risk explicit and reviewable.
3. **Custom Semgrep rules**: encode hard rules from `CLAUDE.md` so the
   CI suite enforces them on every PR (free-form-LLM detection,
   candidate-finding leakage, clause-id catalog validity, missing SPDX).
4. **Air-gap isolation probe** (`tests/security/airgap-isolation.spec.ts`,
   wired into `nightly.yml`) verifies M-006 / ADR-0025 holds against
   future code drift.

## Threat-model Delta

No new threats introduced by Wave-3 (no production code changed). The
following threats were promoted to **explicit tracking** for the first
time:

- M-024 (Working-paper IndexedDB at-rest leak) → moved from "implicit"
  to **Accepted-risk**, reviewed Q3-2026.
- M-025 (CSP `unsafe-inline` interim) → moved to **Planned (Phase 11)**.
- M-023 (OSS supply-chain via install scripts) → newly added; **Planned
  (Phase 11)**.

## Sign-off

- [ ] Reviewer 1 (security): _name_ — _date_
- [ ] Reviewer 2 (lead auditor): _name_ — _date_
