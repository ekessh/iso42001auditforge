<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Getting Started

> This document walks a newly provisioned auditor through passkey
> enrollment and the creation of their first engagement.

---

## Prerequisites

- An AuditForge account provisioned by your firm's operator.
- A FIDO2-capable device: hardware security key (YubiKey 5+), Touch ID
  (macOS), Windows Hello, or Android fingerprint sensor.
- A modern browser (Chrome 120+, Firefox 122+, Safari 17+, Edge 120+).

---

## Step 1 — First Login and Passkey Enrollment

AuditForge uses **WebAuthn (passkeys)** as the primary credential.
Passwords are not used.

1. Navigate to your firm's AuditForge URL (e.g.
   `https://auditforge.example.com`).
2. Enter your email address and click **Continue**.
3. If your account has no passkey yet, you are directed to the
   **Passkey Enrollment** screen.
4. Click **Register passkey**. Your browser presents the platform
   authenticator dialog (Touch ID, Windows Hello, or hardware key).
5. Complete the gesture. AuditForge calls
   `POST /v1/identity/webauthn/register/finish`
   (see `apps/api/src/modules/identity/`), stores the credential, and
   issues a session cookie (HttpOnly, SameSite=Strict, Secure).
6. You are redirected to the **Dashboard**.

### Hardware Key Notes

If you use a roaming authenticator (YubiKey), the browser requests a
PIN on first registration and a tap on each subsequent login. Store a
backup key with your firm's security officer. Key rotation is documented
in [../operator-guide/09-secrets-and-key-rotation.md](../operator-guide/09-secrets-and-key-rotation.md).

---

## Step 2 — Profile Completion

Before creating an engagement, complete your auditor profile:

1. Click **Profile** (top-right avatar).
2. Fill in: full legal name, certification body, scheme (ISO 42001 Lead
   Auditor, Internal Auditor, etc.), certificate number (if CB), and
   expiry date.
3. Upload your qualification evidence (PDF). AuditForge stores this in
   the evidence vault and attaches it to every report you sign.
4. Click **Save profile**.

Profile changes emit a `auditor.profile_updated` ledger event.

---

## Step 3 — Create Your First Engagement

1. Click **New Engagement** from the dashboard.
2. Fill in the engagement wizard:

   | Field | Notes |
   |---|---|
   | Client | Select or create. Client record holds legal name, contact, country, sector. |
   | Engagement type | Stage 1, Stage 2, Surveillance, Re-certification, or Readiness Assessment. |
   | Mode | **Audit Mode** (for CBs performing formal audits) or **Readiness Mode** (for AIMS owners or internal auditors). **Cannot be changed after creation.** See [03-engagement-lifecycle.md](03-engagement-lifecycle.md) and [11-readiness-vs-audit-mode.md](11-readiness-vs-audit-mode.md). |
   | Scope | Select ISO 42001 clauses and Annex A controls in scope. Exclusions require a rationale. |
   | Team | Add co-auditors by email. Each must have an AuditForge account in the same firm. |
   | Planned dates | Stage 1 window, Stage 2 window (if applicable). |

3. Click **Create Engagement**. The system:
   - Creates the engagement record.
   - Locks the scope (editable until `scope_locked` state).
   - Emits `engagement.created` to the audit ledger.
   - Initializes the coverage matrix with all in-scope clauses at
     `untouched` status.

4. You are redirected to the **Engagement Dashboard**.

---

## Step 4 — Explore the Engagement Dashboard

The dashboard has four panels:

| Panel | Content |
|---|---|
| **Coverage heatmap** | Per-clause status: untouched / partial / evidenced / contradicted / N/A. Updates in real time as the conversational engine attributes claims. |
| **Interview queue** | Scheduled and completed interview sessions. |
| **Evidence drawer** | Uploaded files with extraction status. |
| **Candidate findings** | Engine-drafted NCs awaiting auditor review. Visible only to the audit team. |

---

## Next Steps

- [03-engagement-lifecycle.md](03-engagement-lifecycle.md) — detailed
  lifecycle stages.
- [05-conversational-engine.md](05-conversational-engine.md) — run your
  first interview session.
- [04-working-papers.md](04-working-papers.md) — edit working papers
  collaboratively.
