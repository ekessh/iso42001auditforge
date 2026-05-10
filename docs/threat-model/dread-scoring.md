# AuditForge — DREAD Scoring (Wave 3)

<!-- SPDX-License-Identifier: BUSL-1.1 -->

DREAD score per identified threat from `stride-analysis.md`. Each
dimension scored 1–10 (10 = worst); priority = round(mean) — ties broken
by `Affected`. Scoring rubric below the table.

| ID | Threat | D | R | E | A | Disc | Mean | Priority |
|----|--------|---|---|---|---|------|------|----------|
| T-F1-IS | XSS exfil of bearer token (interim CSP) | 7 | 6 | 5 | 4 | 4 | 5.2 | P2 |
| T-F1-DOS | Auth-endpoint brute force | 4 | 8 | 6 | 7 | 7 | 6.4 | P2 |
| T-F2-EOP | mass-assignment of `firm_id` (mitigated) | 9 | 8 | 3 | 9 | 2 | 6.2 | P2 |
| T-F3-IS | Cross-firm Yjs subscribe (mitigated) | 9 | 6 | 4 | 6 | 3 | 5.6 | P2 |
| T-F3-T | Server-side Doc tampering by insider | 8 | 4 | 3 | 6 | 2 | 4.6 | P3 |
| T-F4-IS | Probe leaks engagement data to target | 8 | 5 | 5 | 4 | 5 | 5.4 | P2 |
| T-F4-EOP | Probe response triggers parser RCE | 9 | 4 | 3 | 5 | 5 | 5.2 | P2 |
| T-F5-T | Tampered PDF post-publish | 9 | 3 | 4 | 9 | 4 | 5.8 | P2 |
| T-F5-EOP | Forged confirmation token | 9 | 4 | 3 | 9 | 3 | 5.6 | P2 |
| T-F6-IS | Auditee data leak to cloud LLM | 9 | 5 | 4 | 8 | 4 | 6.0 | P2 |
| T-F6-EOP | Prompt injection → tool execution | 9 | 5 | 5 | 7 | 5 | 6.2 | P2 |
| T-F7-T | MCP tool poisoning (description swap) | 9 | 5 | 4 | 6 | 4 | 5.6 | P2 |
| T-F7-DOS | MCP tool flood | 4 | 8 | 6 | 5 | 7 | 6.0 | P2 |
| T-X-T  | Supply-chain compromise via npm dep | 9 | 6 | 5 | 9 | 5 | 6.8 | P1 |
| T-X-D  | Cloud bill amplification (LLM) | 5 | 7 | 6 | 6 | 6 | 6.0 | P2 |
| T-X-R  | Audit ledger truncation | 9 | 4 | 3 | 9 | 3 | 5.6 | P2 |
| T-F1-S | Phishing of password fallback | 6 | 6 | 5 | 6 | 5 | 5.6 | P2 |
| T-F2-R | Disputed engagement-creation event | 5 | 4 | 3 | 5 | 3 | 4.0 | P3 |
| T-F4-S | DNS rebind to internal host (SSRF) | 8 | 5 | 5 | 7 | 5 | 6.0 | P2 |
| T-F5-D | TSA outage blocks publish | 4 | 7 | 5 | 6 | 6 | 5.6 | P3 |
| T-F6-DOS | Cloud provider rate-limit outage | 4 | 6 | 5 | 4 | 6 | 5.0 | P3 |
| T-F7-EOP | MCP write without confirmation (mitigated) | 9 | 4 | 3 | 9 | 3 | 5.6 | P2 |

## Top-priority items (P1)

- **T-X-T — Supply-chain compromise via npm dep**: highest mean (6.8)
  driven by Reproducibility (any attacker who lands a malicious
  version achieves it) + Affected (every install). Mitigation: pinned
  lockfile, OSV-Scanner + Trivy nightly, SBOM on release, no
  `latest` tags in CI base images.

## Priority-2 cluster

Threats with mean ∈ [5.0, 6.5] form the dominant cluster. Mitigation
status is tracked per-row in `mitigation-tracker.md`. Several threats
in this band have **mitigations already implemented**; they remain in
the table because the residual risk is non-zero (e.g. Yjs cross-firm
subscribe is mitigated, but a future change to the auth gateway could
re-introduce it — the threat is permanent even when mitigated).

## Scoring Rubric

- **Damage (D)**: 10 = full audit-record corruption; 7 = single firm
  data leak; 4 = single-engagement disruption; 1 = cosmetic.
- **Reproducibility (R)**: 10 = trivial / no auth required; 6 = any
  authenticated user; 3 = privileged user only; 1 = single-use
  precondition.
- **Exploitability (E)**: 10 = public exploit; 6 = expert needed; 3 =
  internals knowledge required; 1 = theoretical.
- **Affected (A)**: 10 = entire platform; 7 = one firm; 4 = one
  engagement; 1 = one user.
- **Discoverability (Disc)**: 10 = visible in public CVE feeds; 6 =
  observable via API exploration; 3 = source-code review required;
  1 = inside-knowledge required.

## Re-score Cadence

DREAD is re-scored at each per-phase security review gate
(`CLAUDE.md` Per-Phase Gates §2). The mitigation tracker is updated
in lock-step.
