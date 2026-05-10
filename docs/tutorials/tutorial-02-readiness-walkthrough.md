<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Tutorial 02: Readiness Mode Walkthrough

> End-to-end walkthrough of a Readiness Mode engagement with the
> mandatory non-certification disclaimer.

---

## Scenario

You are the Head of AI Governance at **Beta Tech Ltd**. You want to
assess Beta Tech's readiness for ISO 42001 certification before engaging
a CB. You will use AuditForge in Readiness Mode for this self-assessment.

---

## Key Differences in Readiness Mode

Before starting, note what is different from Audit Mode:

- Reports use "Improvement Items" not "Candidate Findings."
- All candidate NCs must have verified CAPAs before the engagement can
  issue.
- The issued report carries the mandatory non-certification disclaimer.
- No auditee portal (you are the auditee).

---

## Step 1: Create the Engagement

1. Click **New Engagement**.
2. Client: your own organization (create `Beta Tech Ltd` as a client
   with yourself as contact).
3. Engagement type: `Readiness Assessment`.
4. Mode: **Readiness Mode** ← critical selection.
5. Scope: all clauses 4–10 + the Annex A controls you believe apply to
   your AIMS.
6. Team: you as lead; optionally a colleague as co-assessor.
7. Click **Create Engagement**.

---

## Step 2: Run Through the Assessment

Follow the same workflow as Tutorial 01 for interviews, evidence upload,
and claim attribution. The UI labels differ:

| Audit Mode label | Readiness Mode label |
|---|---|
| Candidate Findings | Improvement Items |
| Promote to Finding | Add to Action Plan |
| Formal Finding | Action Item |

---

## Step 3: CAPA is Required Before Termination

When you identify a gap (e.g., no documented AI risk assessment), the
system creates an Improvement Item. In Readiness Mode, you must:

1. Create a corrective action for the Improvement Item.
2. Implement the action (e.g., draft and approve the risk assessment).
3. Upload verification evidence.
4. Close the CAPA.

Only when all Improvement Items have closed CAPAs can the engagement
move to `reporting`.

---

## Step 4: Generate the Readiness Report

1. Click **Generate Report**.
2. Write the assessment summary. Use "appears to conform" language —
   not "conforms" (only a CB can conclude conformity).
3. Click **Render PDF**.
4. Review the PDF. Verify the mandatory disclaimer appears prominently:

   > **This report is the output of a readiness self-assessment …
   > must not be represented as [certification] …**

5. Click **Sign and Issue**.

The report is signed by your key (as AIMS owner, not as an accredited
auditor). The disclaimer is hash-anchored in the ledger.

---

## Step 5: Share with Your CB

The readiness report can be shared with a prospective CB as background
context. Remind the CB that Readiness Mode findings are not admissible
as audit evidence — the CB will perform their own independent Stage 1
and Stage 2 audits.

---

## Next Steps

- [tutorial-01-first-engagement.md](tutorial-01-first-engagement.md)
  — formal Audit Mode.
- [tutorial-03-sign-and-publish-report.md](tutorial-03-sign-and-publish-report.md)
  — signing details.
