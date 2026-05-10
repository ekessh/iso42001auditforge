<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Sampling

> This document explains the sampling planner, supported methods, and
> the seed-stable replay guarantee.

---

## Why Sampling Matters

ISO 17021-1 §9.1.8 requires that sampling be representative and
appropriately sized. AuditForge's sampling planner automates the
calculations but the auditor selects the parameters and approves the
sample.

---

## Sampling Methods

| Method | API endpoint | Use case |
|---|---|---|
| **Attribute (binary)** | `POST /v1/samples/calculate-size` with `method: attribute` | Yes/no conformance checks (e.g. "does this system have a documented risk treatment?") |
| **Variable (continuous)** | `POST /v1/samples/calculate-size` with `method: variable` | Quantitative checks (e.g. accuracy scores, bias metrics) |
| **Stratified random** | `method: stratified` | Heterogeneous populations (multiple AI system types) |
| **Judgmental** | `method: judgmental` | High-risk or novel AI systems where statistical sampling is impractical |

For attribute sampling, the planner uses the hypergeometric distribution
(finite population) or binomial approximation (large population) with
auditor-selectable confidence level (95% or 99%) and tolerable error
rate.

---

## Drawing a Sample

1. Navigate to **Sampling** in the engagement sidebar.
2. Click **+ New Sample**.
3. Select method, population, confidence level, and tolerable error rate.
4. The system computes the required sample size
   (`POST /v1/samples/calculate-size`).
5. Click **Draw Sample** (`POST /v1/samples/draw`).
6. The sample is drawn using a deterministic PRNG seeded with
   `(engagement_id, sample_id, auditor_confirmed_seed)`. The seed is
   ledger-anchored at draw time.

---

## Seed-Stable Replay

The deterministic seed means the same sample can be reconstructed
identically at any future point — for peer review, accreditation
inspection, or dispute resolution — by re-running the draw with the
same parameters and seed.

`GET /v1/samples/{id}` returns the full draw parameters. Any auditor or
reviewer can verify the sample by replaying the draw.

---

## Replacing a Sampled Unit

If a sampled unit is inaccessible (system decommissioned, document lost):

1. Open the sample and click **Replace Unit**.
2. Document the reason for replacement.
3. Call `POST /v1/samples/override` with the original unit ID and the
   replacement.
4. The override is ledger-anchored (`sample.unit_replaced` event). The
   report notes the replacement.

Replacements must not be used to cherry-pick favorable units. The
auditor's professional judgment and the ledger record are the controls.

---

## Connecting Samples to Findings

If a sampled unit reveals a non-conformity:

1. Open the finding in the sample result.
2. Link the sample draw record to the candidate finding.
3. The finding automatically inherits the sample ID and draw parameters
   for the audit trail.

---

## Related Documents

- [09-findings-workflow.md](09-findings-workflow.md) — after a sample
  reveals a finding.
- [../api-reference/samples.md](../api-reference/samples.md) — full API.
