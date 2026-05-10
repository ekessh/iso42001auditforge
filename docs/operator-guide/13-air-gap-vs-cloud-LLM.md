<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Air-Gap vs Cloud LLM Trade-Off Analysis

> Decision guide for operators choosing between fully local inference
> and cloud-opt-in per engagement.

---

## Summary Comparison

| Dimension | Air-Gap (Local LLM only) | Cloud LLM Opt-In |
|---|---|---|
| **Data residency** | All data stays within the cluster | Prompt data leaves the perimeter (Anthropic / OpenAI receive portions of the claim extraction context) |
| **Auditee consent required** | No | Yes — written consent required at engagement creation; stored in consent registry |
| **Inference quality (small tasks)** | Llama 3.1 8B ≈ Haiku — comparable | GPT-4o-mini / Claude Haiku — marginally better for edge cases |
| **Inference quality (reasoning tasks)** | DeepSeek-R1 — strong; CoT traces local | Claude extended thinking / o-series — state of the art |
| **Cost** | GPU hardware / cloud GPU instance | Pay-per-token; can be significant for large evidence corpora |
| **Latency** | Depends on GPU availability; can be > 5 s for 32B models on single GPU | 1–3 s for Haiku/Sonnet; < 1 s for embedding |
| **Privacy regulation compliance** | Easier — no subprocessors for LLM | Anthropic and OpenAI are subprocessors; DPA required (GDPR Art. 28) |
| **Air-gap regulatory requirement** | Met | Not met — cloud API calls require internet |
| **Model auditability** | Model hash logged; fully reproducible | Version string logged; model weights not inspectable |

---

## When to Use Air-Gap Mode

Use air-gap mode (local LLM only) when:

- The engagement involves **classified, legally privileged, or highly
  sensitive AIMS** (financial models with proprietary data, medical AI,
  government AI systems).
- The client **explicitly requires no data leaves their jurisdiction**.
- The deployment environment is physically isolated (SCIF, secure data
  centre, disconnected OT environment).
- **Regulatory requirements** (e.g. FedRAMP High, IL4/IL5, certain EU
  national security frameworks) prohibit external API calls.

---

## When to Allow Cloud LLM Opt-In

Allow cloud LLM opt-in when:

- The AIMS under audit does not process classified or legally privileged
  data.
- The auditee has provided written consent and a Data Processing
  Agreement covers the relevant AI providers as subprocessors.
- The auditor requires **reasoning-tier** capabilities (complex
  multi-hop attribution, rare synthesis tasks) where local model quality
  is insufficient.
- Inference latency is a significant workflow bottleneck.

---

## Compliance Notes

When cloud LLM is opted-in:

- Anthropic and OpenAI are **data subprocessors** under GDPR Art. 28.
  The operator must ensure they are listed in the firm's ROPA and that
  appropriate SCCs/adequacy mechanisms are in place.
- The consent record in AuditForge documents that the auditee was
  informed of cloud processing. This record is included in the issued
  report.
- Cloud providers do not train on API data per their enterprise terms,
  but the operator should verify the current ToS before enabling.

---

## Related Documents

- [05-air-gap-deployment.md](05-air-gap-deployment.md) — how to deploy
  in air-gap mode.
- [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md)
  — provider guard implementation.
- [../compliance/dpia-template.md](../compliance/dpia-template.md) —
  DPIA template for cloud LLM.
