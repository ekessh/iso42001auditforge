<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Working Papers

> This document explains how AuditForge's Yjs CRDT working papers work,
> how to collaborate offline, and how evidence is linked.

---

## What Working Papers Are

A working paper (WP) is the auditor's in-progress documentation artifact
for a specific area of the audit: clause notes, interview summaries,
evidence annotations, draft observations. Each WP maps to one or more
ISO 42001 clauses.

Working papers are **not** the audit report. They are the auditor's
private workspace. Only the audit team can read them; they are never
shared with the auditee.

---

## Collaborative Editing (Yjs CRDT)

AuditForge uses **Yjs** conflict-free replicated data types for all
working paper text. This means:

- Multiple auditors can edit the same WP simultaneously.
- Edits merge automatically — no "last writer wins" overwrites.
- Edits made offline sync on reconnect without loss.

The Yjs Doc for each WP is served via `y-websocket` over the API's
WebSocket gateway (`GET /v1/sync/health` for health). Each room is gated
by RBAC: the API checks `(principal, working_paper_id) → role` on every
upgrade and on every write message. See ADR-0023.

### Y.Doc Shape per WP Type

| WP Type | Yjs structure |
|---|---|
| Clause notes | `Y.XmlText` (rich text; supports clause-link annotations) |
| Interview summary | `Y.XmlText` + `Y.Map` (structured metadata: date, participants, clauses) |
| Evidence annotations | `Y.Array<Y.Map>` (one entry per evidence file; map holds `evidenceId`, `annotation`, `clause_links`) |
| Observation draft | `Y.XmlText` + `Y.Map` (observation_type, severity, clause_id) |

See [../concepts/working-paper-crdt.md](../concepts/working-paper-crdt.md)
for the full shape specification.

---

## Offline Mode

Working papers are persisted locally in **IndexedDB** via `y-indexeddb`.
The store is namespaced per `(firmId, userId, workingPaperId)` to prevent
cross-tenant leakage on shared devices.

While offline:

1. Edits accumulate in IndexedDB.
2. On reconnect, the browser sends all offline ops via
   `Y.applyUpdate` to the y-websocket room.
3. The server merges ops and emits a `working_paper.synced` ledger event
   with a diff summary.

> **Important:** IndexedDB data is stored unencrypted by the browser. Do
> not use AuditForge on shared or untrusted devices while offline. The
> operator guide covers device management policies in
> [../operator-guide/09-secrets-and-key-rotation.md](../operator-guide/09-secrets-and-key-rotation.md).

---

## Creating a Working Paper

1. Open the engagement and click **Working Papers** in the left nav.
2. Click **+ New Working Paper**.
3. Select the WP type and the clauses it covers.
4. The WP is created and opens immediately in the editor.
5. A `working_paper.created` event is written to the audit ledger.

---

## Linking Evidence to a Working Paper

Every working paper has an **Evidence Drawer** panel on the right. To
link evidence:

1. Upload a file via **Evidence → Upload** (or drag-and-drop into the
   drawer). See [07-evidence-extraction.md](07-evidence-extraction.md).
2. After upload, the file appears in the drawer with extraction status.
3. Click **Link to WP** next to the file. The engine's extracted claims
   from that file are surfaced.
4. Confirm or reject each claim attribution (auditor gate).
5. Confirmed claims update the coverage matrix.

Evidence links are stored in the WP's `Y.Array` and in the `evidence_links`
relational table for querying. Both are sourced from the same
`evidence.linked` ledger event.

---

## Finalizing and Submitting

When a WP is complete:

1. Click **Finalize** (`POST /v1/working-papers/{id}/finalize`). This
   marks the WP as read-only and emits `working_paper.finalized`.
2. If peer review is enabled, click **Submit for Review**
   (`POST /v1/working-papers/{id}/submit`).

Finalized WPs are included in the report's evidence annex automatically.

---

## Keyboard Shortcuts

See [appendix-keyboard-shortcuts.md](appendix-keyboard-shortcuts.md) for
the full working-paper editor shortcut reference.

---

## Related Documents

- [ADR-0023](../adr/0023-yjs-y-websocket-rbac-indexeddb.md) — Yjs design
  decisions.
- [../concepts/working-paper-crdt.md](../concepts/working-paper-crdt.md)
  — Y.Doc shape specification.
- [07-evidence-extraction.md](07-evidence-extraction.md) — VLM extraction.
- [13-peer-review-and-qa-checklist.md](13-peer-review-and-qa-checklist.md)
  — review workflow.
