<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Tutorial 01: Your First Engagement

> Narrative walkthrough: create a fictional client, plan an audit,
> execute one interview, and draft one finding.

---

## Scenario

You are a lead auditor at a certification body. Your client is
**Acme AI Corp**, a software company that has built an AI-powered
customer support system. You are performing the Stage 2 certification
audit for ISO/IEC 42001:2023. The scope covers all mandatory clauses
(4–10) and a subset of Annex A controls relevant to the customer support
AI system.

---

## Step 1: Create the Client

1. Navigate to **Clients → New Client**.
2. Fill in:
   - Legal name: `Acme AI Corp`
   - Country: `United Kingdom`
   - Sector: `Software / Technology`
   - Contact: `jane.smith@acme.example.com`
3. Click **Create Client**.

---

## Step 2: Create the Engagement

1. Click **New Engagement**.
2. Select client: `Acme AI Corp`.
3. Engagement type: `Stage 2`.
4. Mode: **Audit Mode** (this is a formal certification audit).
5. Scope:
   - Include all clauses 4–10.
   - Include Annex A controls: A.2.2, A.2.6, A.3.2, A.5.2, A.6.1.2,
     A.6.2.3, A.6.2.5, A.8.4, A.10.1.
   - Exclude: A.4.2 (Acme AI does not use AuditForge itself).
6. Team: add yourself as lead auditor.
7. Planned dates: Stage 2, May 12–14, 2026.
8. Click **Create Engagement**.

The coverage matrix shows all included clauses at `untouched`.

---

## Step 3: Declare Impartiality

1. Navigate to **Engagement → Team → Impartiality**.
2. Complete the conflict-of-interest checklist.
3. For this tutorial, select "No conflict" for all items.
4. Sign (click the WebAuthn gesture button).

The system advances to `scoping` confirmed.

---

## Step 4: Create the Audit Plan

1. Navigate to **Audit Plan → New Plan**.
2. Add interview sessions:
   - May 12, 09:00: "AIMS Overview" — focus clauses 4, 5.
   - May 12, 14:00: "Risk Management" — focus clause 6.
   - May 13, 09:00: "Operations" — focus clauses 8, 9, 10.
   - May 13, 14:00: "AI System Deep Dive" — focus Annex A controls.
3. Add a document request list: risk register, training data lineage
   documentation, model card, internal audit records.
4. Click **Approve Plan**.

The engagement moves to `active`.

---

## Step 5: Create a Working Paper

1. Navigate to **Working Papers → New Working Paper**.
2. Type: `Clause Notes`.
3. Clauses: `4`, `5`.
4. Name: `AIMS Context and Leadership — May 12 AM`.
5. Click **Create**.

The editor opens. Type your pre-interview research notes.

---

## Step 6: Run the Interview (Simulated)

For this tutorial, we will create a non-live interview session and
manually enter an answer.

1. Navigate to **Interviews → New Interview → Planned Session**.
2. Link to the audit plan session "AIMS Overview".
3. Interviewees: `Jane Smith, CEO`.
4. Click **Start**.

The Interview Composer opens. The question queue shows:

- "Can you describe the scope of the AI Management System, including
  which AI systems are in scope?" (Library ID: `LQ-4.3-A`)
- "How were interested parties identified and their requirements
  determined?" (Library ID: `LQ-4.2-A`)

5. Accept the first question (click **Use**).
6. In the **Record Answer** panel, type:
   > "Our AIMS covers the customer support AI system — that's our
   > primary AI system. We also use an internal code review AI but that
   > is out of scope for this certification as it's still in pilot."

7. Click **Attribute**. The attribution engine processes the answer:
   - Claim 1: "Customer support AI system is in-scope for the AIMS"
     — attributed to `§4.3` with confidence 0.91.
   - Claim 2: "Internal code review AI is excluded from scope"
     — attributed to `§4.3` with confidence 0.84.

8. Both attributions are in the medium-high confidence band. Click
   **Accept all** to confirm both.

The coverage matrix updates: `§4.3` moves from `untouched` to `partial`.

---

## Step 7: Upload Evidence and Extract Claims

1. Navigate to **Evidence → Upload**.
2. Upload `acme-ai-aims-scope-document.pdf` (fictional document).
3. After upload, click **Extract Claims**.
4. The VLM extracts claims. Review and confirm those that support `§4.3`.

After confirmation, `§4.3` moves to `evidenced`.

---

## Step 8: Review a Candidate Finding

Suppose the NC drafter identified a potential issue: "No evidence of
interested party requirements formally documented (§4.2)."

1. Open **Candidate Findings**.
2. Review the NC draft:
   - Observation: "The AIMS scope document references interested parties
     but no formal register of interested party requirements was
     provided."
   - Suggested severity: `minor NC`.
   - Clause: `§4.2`.
3. Edit the observation text to be more precise.
4. Click **Promote to Finding**.

A formal finding is created with status `open`.

---

## Step 9: What's Next

Continue with the remaining interview sessions, evidence uploads, and
probe runs for the other clauses. When all clauses are covered, see:

- [../auditor-guide/13-peer-review-and-qa-checklist.md](../auditor-guide/13-peer-review-and-qa-checklist.md)
  — pre-publication QA.
- [../auditor-guide/12-reports-and-signing.md](../auditor-guide/12-reports-and-signing.md)
  — sign and issue the report.
- [tutorial-03-sign-and-publish-report.md](tutorial-03-sign-and-publish-report.md)
  — full report-signing walkthrough.
