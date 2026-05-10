<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Appendix: Glossary

> Term definitions specific to AuditForge's implementation. For the
> comprehensive cross-standard glossary, see
> [../concepts/terminology.md](../concepts/terminology.md).

---

## A

**AIMS** — AI Management System. The organizational system of policies,
processes, roles, and controls for managing AI-related risks and
opportunities. Defined in ISO/IEC 42001:2023 §3.1.

**Audit Mode** — The engagement mode used by accredited Certification
Bodies for formal conformity assessment. Distinguished from Readiness
Mode by: formal finding workflow, auditee portal access, and report type.

**Attribution** — The process of mapping an answer utterance or evidence
extract to one or more ISO 42001 clause IDs. Performed by the Answer
Attribution sub-engine; confirmed by the auditor.

**Audit Ledger** — The append-only, hash-chained, Ed25519-signed record
of all state-changing events in an engagement. The ledger is the source
of truth; operational tables are projections.

---

## B

**Bi-temporal claim** — A claim in the claim graph with two time axes:
`event_time` (when the auditee says the fact became true) and
`ingestion_time` (when AuditForge recorded it). Old claims are
invalidated by setting `event_time_end`; they are never deleted.

---

## C

**CAPA** — Corrective Action and Preventive Action. A structured record
linked to a formal finding documenting root cause, corrective action,
responsible party, due date, and verification evidence.

**Candidate Finding** — An engine-drafted potential non-conformity that
has not yet been reviewed by the auditor. Candidate findings are never
visible to the auditee.

**Claim** — An atomic fact extracted from an interview answer or evidence
file, attributed to an entity and a clause. Claims are the units stored
in the claim graph.

**Claim Graph** — The Postgres-backed adjacency structure storing claims,
their bi-temporal validity, and relations between them. See
[../concepts/claim-graph.md](../concepts/claim-graph.md).

**Coverage Matrix** — The per-clause status grid showing: untouched,
partial, evidenced, contradicted, or N/A. Coverage score is computed
from this matrix per the formula in
[../concepts/coverage-calculation.md](../concepts/coverage-calculation.md).

---

## E

**Episode** — The immutable raw record (interview utterance, evidence
file, probe result) from which claims are extracted. Episodes are the
source of truth; claims are derived.

**Engagement** — The top-level container for an audit: client, scope,
mode, team, plan, interviews, evidence, findings, and report.

---

## F

**Finding** — A formally promoted non-conformity or opportunity for
improvement. Distinguished from a candidate finding by: auditor promotion
action, visibility (to team and, after issuance, to auditee), and
inclusion in the issued report.

---

## J

**JCS** — JSON Canonicalization Scheme (RFC 8785). The deterministic
serialization of JSON used before signing, ensuring byte-identical
hashes regardless of key ordering.

---

## M

**Mode** — See Audit Mode / Readiness Mode. Set at engagement creation;
cannot be changed.

---

## N

**NC** — Non-Conformity. A finding where the auditee's AIMS does not
meet an ISO 42001 normative requirement. Classified as major (system
failure or high-impact gap) or minor (isolated lapse).

---

## O

**OFI** — Opportunity for Improvement. A finding that is not a
non-conformity but identifies a potential enhancement to the AIMS.

---

## P

**Probe** — An automated conformance check that runs against the AI
system under audit. See [08-probes-and-conformance-checks.md](08-probes-and-conformance-checks.md).

---

## R

**Readiness Mode** — The engagement mode used by AIMS owners or internal
auditors for self-assessment. Produces a readiness report with a
mandatory non-certification disclaimer.

**RFC 3161** — The internet standard for trusted timestamping. AuditForge
obtains an RFC 3161 token from a configured TSA for every
`report.publish` ledger event.

---

## S

**SoA** — Statement of Applicability. The document declaring which ISO
42001 Annex A controls are applicable to the AIMS under audit and the
justification for any exclusions.

**Scope** — The set of ISO 42001 clauses and Annex A controls included
in the engagement. Locked after the `scoping` lifecycle stage.

---

## T

**TSA** — Timestamp Authority. An external service that provides RFC 3161
timestamp tokens, independently attesting the time of signing.

**Tier Router** — The component in `packages/llm-provider` that routes
LLM inference requests to the appropriate model tier (small / medium /
large / reasoning) based on task type and available providers.

---

## W

**Working Paper** — The auditor's in-progress documentation artifact for
a specific area of the audit. Collaborative (Yjs CRDT), offline-capable,
never shared with the auditee.
