<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Conversational Audit Engine

> This document explains how the four sub-engines assist the auditor,
> what they produce, and the auditor-confirmation gate that governs
> every state transition.

---

## Engine Overview

The conversational engine has four sub-engines plus a memory layer and
an LLM provider abstraction. They operate in the background of every
interview session and evidence-extraction job.

| Sub-engine | What it does |
|---|---|
| **Question Generator** | Proposes interview questions from the library or as follow-ups; never invents questions from scratch |
| **Answer Attribution** | Maps interview answers and evidence extracts to ISO 42001 clause IDs with confidence scores |
| **Adaptive Question Evolution** | Adjusts the remaining question queue based on coverage gaps and answer sentiment |
| **Parallel NC Drafter** | Drafts candidate non-conformities concurrently during the interview; never promotes them |

All four sub-engines are served by `packages/conversational-engine`.

---

## The Auditor-Confirmation Gate

**This is the most important rule in the system.**

Engine outputs are **always drafts**. The only state-transition trigger
is explicit auditor confirmation. Specifically:

| Action | Who initiates |
|---|---|
| Attribute a claim to a clause | Auditor (single-click for confidence 0.60–0.85; bulk confirm for >0.85 with one review pass) |
| Promote a candidate finding to a formal finding | Auditor |
| Accept a question from the library | Auditor |
| Accept an NC draft | Auditor (edit before accepting if needed) |

No coverage score, finding, or report conclusion is ever written by the
engine without an auditor action. `ADR-0012` ("Engine outputs as drafts")
enforces this at the code level: the service layer raises a hard error
if any engine pathway attempts to write a `confirmed=true` row without
a `principal_id` from an auditor session.

---

## Question Generator

### Sources

Questions come from the **question library** (`packages/interview-library`),
not from free-form LLM generation. The library contains:

- Primary questions per clause (covering the clause's normative requirement).
- Follow-up probes per answer pattern (implementation evidence, metrics,
  review cycle, competence).
- MCP-specific probes (P-MCP-01 through P-MCP-08).
- Sector and context overlays (financial services, healthcare, government).

Each library question has a unique `library_question_id`, a clause ref,
a coverage rationale, and a minimum number of implementation-evidence
follow-ups required for `evidenced` status.

### Confidence Bands

| Band | Value | UI behavior |
|---|---|---|
| High | > 0.85 | Auto-link shown; bulk confirm available after review pass |
| Medium | 0.60–0.85 | Explicit single-click required |
| Low | < 0.60 | Shown in opt-in panel only; auditor must open and decide |

### Provenance Display

Every suggested question shows:

- Library question ID (e.g. `LQ-6.1.2-A`).
- Clause ref (e.g. `ISO 42001:2023 §6.1.2`).
- Coverage rationale (one sentence explaining why this question covers
  the clause).
- Model and prompt template version used to generate any follow-up.

---

## Answer Attribution

After the auditor records an answer (transcript or manual entry), the
attribution engine:

1. Splits the answer into atomic claims using the schema-constrained
   extractor (tier: small LLM + structured output).
2. Embeds each claim with BGE-M3 or text-embedding-3-large.
3. Retrieves the top-k clause candidates from `pgvector` similarity search.
4. Re-ranks with a medium-tier LLM, producing a ranked list with
   confidence scores.
5. Returns the ranked list to the UI; the auditor confirms or rejects.

The re-ranker is constrained: it can only output clause IDs from the
ISO 42001 catalogue. CI probe `P-AF-CLAUSE-01` enforces this — any
hallucinated clause ID fails the probe and blocks the release.

All attribution steps are logged to `llm_invocations` with full
provenance. The audit ledger receives an `answer.attributed` event after
the auditor confirms.

---

## Adaptive Question Evolution

After each confirmed attribution, the engine computes the updated
coverage matrix and re-scores the remaining questions:

- Questions for already-`evidenced` clauses move to the end of the queue.
- Questions for `contradicted` or `partial` clauses are promoted.
- New follow-up questions for the just-answered clause are inserted if
  the coverage rationale is not yet met.

The auditor sees the updated queue in the **Interview Composer**. They
can reorder, skip, or manually add questions from the library. The engine
cannot force a question; the auditor controls the queue.

---

## Parallel NC Drafter

While the interview runs, the NC drafter monitors attributed claims
for potential non-conformities: claims that contradict a clause requirement,
or clauses that remain `untouched` beyond the expected interview depth.

For each candidate NC, the drafter produces:

- Clause reference.
- Observation text (draft; based on attributed claim + clause text).
- Suggested severity (minor / major / opportunity; auditor decides finally).
- Supporting evidence links.
- Model and prompt template version.

Candidate NCs appear in the **Candidate Findings** panel after the
interview session ends. They are **not** visible to the auditee.

The auditor reviews each candidate: edit, promote to formal finding, or
dismiss with rationale. Both promote and dismiss are auditor actions that
emit ledger events.

---

## LLM Provider Routing

The engine routes tasks to the tier router in `packages/llm-provider`:

| Task | Tier | Default local model |
|---|---|---|
| Claim extraction, embedding | Small | Llama 3.1 8B / BGE-M3 |
| Attribution re-rank, NC drafting | Medium | Qwen 2.5 32B |
| Long-context synthesis | Large | Qwen3-30B-A3B |
| High-stakes CoT attribution | Reasoning | DeepSeek-R1 |

Cloud models (Anthropic, OpenAI) are opt-in per engagement with
written auditee consent. See [../concepts/tier-router.md](../concepts/tier-router.md)
and [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md).

---

## Related Documents

- [06-live-interviews.md](06-live-interviews.md) — real-time session UI.
- [07-evidence-extraction.md](07-evidence-extraction.md) — VLM path.
- [09-findings-workflow.md](09-findings-workflow.md) — candidate to formal.
- [ADR-0012](../adr/0012-engine-outputs-as-drafts.md) — engine draft rule.
- [ADR-0011](../adr/0011-llm-provider-abstraction.md) — tier router.
- [../concepts/tier-router.md](../concepts/tier-router.md) — routing logic.
