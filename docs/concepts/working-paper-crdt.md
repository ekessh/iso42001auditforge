<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: developer
adr: 0023
cross-refs:
  - docs/adr/0023-yjs-y-websocket-rbac-indexeddb.md
  - docs/auditor-guide/04-working-papers.md
  - docs/diagrams/crdt-sync.mmd
-->

# Working Paper CRDT

> This document specifies the Yjs Y.Doc shape for each working paper
> type and the sync architecture.

---

## Y.Doc Shape per Working Paper Type

### Clause Notes WP

```
Y.Doc
└── xmlBody: Y.XmlText
      Rich text body with inline annotations:
      - clause_link: { clauseId: string, standard: string }
      - evidence_ref: { evidenceId: string, snippet: string }
```

### Interview Summary WP

```
Y.Doc
├── xmlBody: Y.XmlText
│     Rich text summary of the interview
└── meta: Y.Map
      sessionId:     string
      date:          string (ISO 8601)
      participants:  Y.Array<string>
      clauses:       Y.Array<string>  (clause IDs covered)
      duration_min:  number
```

### Evidence Annotation WP

```
Y.Doc
└── annotations: Y.Array<Y.Map>
      Each map:
        evidenceId:    string (uuid)
        filename:      string
        annotation:    string (rich text; plain for now)
        clause_links:  Y.Array<string>
        claims_linked: Y.Array<string>  (claim IDs)
        linked_at:     string (ISO 8601)
```

### Observation Draft WP

```
Y.Doc
├── xmlBody: Y.XmlText
│     Draft observation text (auditor edits directly)
└── meta: Y.Map
      observation_type:  'major_nc' | 'minor_nc' | 'ofi'
      severity:          'major' | 'minor' | 'opportunity'
      clause_id:         string
      linked_finding_id: string | null
      draft_by:          string (auditor user ID)
```

---

## Offline Persistence

Each Y.Doc is persisted in IndexedDB via `y-indexeddb`. The IndexedDB
store key is:

```
auditforge::${firmId}::${userId}::wp::${workingPaperId}
```

The triple namespace prevents cross-tenant leakage on shared devices.

On page load, the Y.Doc is initialized from IndexedDB and the
y-websocket connection is established. If the server's state is ahead
of the local state, the server sends the missing operations. If the
local state is ahead (offline edits), the client sends the offline ops.
Yjs CRDT semantics guarantee convergence.

---

## RBAC per Room

Each y-websocket room corresponds to one working paper (room ID =
`working_paper_id`). Room access is controlled by the API's
`WorkingPaperRoomGuard`:

1. On WebSocket upgrade: verify session token; resolve `(principal,
   working_paper_id) → role`.
2. On every write message: re-check the role (30-second LRU cache on
   `(token, workingPaperId)`).
3. Deny with WebSocket close code `4403` if unauthorized.

Roles allowed to write: `lead_auditor`, `co_auditor`.
Roles allowed to read: all of the above + `reviewer` (read-only room).

---

## Ledger Events from CRDT

Every Y.Doc commit produces a ledger event so the working paper history
is reconstructable from the ledger alone:

| Event type | When emitted |
|---|---|
| `working_paper.edited` | Each write op relayed by the server |
| `working_paper.synced` | On reconnect sync (includes diff summary) |
| `working_paper.finalized` | When `POST /v1/working-papers/{id}/finalize` is called |
| `working_paper.restored` | When the auditor restores a prior checkpoint |

---

## Compaction

The y-indexeddb store grows with every edit operation. A compaction job
runs every 7 days:

1. Snapshot the Y.Doc to a checkpoint binary (`Y.encodeStateAsUpdate`).
2. Store the checkpoint in MinIO.
3. Prune pre-checkpoint deltas from IndexedDB.
4. Emit `working_paper.compacted` to the ledger.

The server-side Yjs document is also compacted to reduce memory usage
when a room is idle.

---

## Cross-References

- [ADR-0023](../adr/0023-yjs-y-websocket-rbac-indexeddb.md) — design
  decisions.
- [../diagrams/crdt-sync.mmd](../diagrams/crdt-sync.mmd) — sync
  sequence diagram.
- [../auditor-guide/04-working-papers.md](../auditor-guide/04-working-papers.md)
  — auditor perspective.
