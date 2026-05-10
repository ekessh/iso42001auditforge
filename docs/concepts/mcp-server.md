<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: developer, auditor
adr: 0016
cross-refs:
  - docs/adr/0016-mcp-server-scaffold.md
  - docs/diagrams/mcp-server-flow.mmd
  - docs/developer-guide/08-adding-an-mcp-tool.md
-->

# MCP Server

> This document explains the AuditForge MCP server: registered tools,
> RBAC, receipt signing, and the AI system self-profile.

---

## What the MCP Server Does

The MCP server (`apps/mcp-server`) exposes AuditForge's audit tools
via the Model Context Protocol. An AI assistant (Claude Desktop,
Cursor, or any MCP-compatible client) can:

- Query engagement coverage.
- List candidate findings.
- Retrieve working paper content.
- Trigger a probe execution.
- Read the audit ledger.

Every tool call goes through RBAC, is ledger-anchored, and produces a
signed receipt. The MCP server is a read-heavy interface; state-changing
operations (promote finding, sign report) are reserved for the primary
web UI with explicit auditor confirmation.

---

## Registered Tools

| Tool name | Description | Required roles |
|---|---|---|
| `get_engagement` | Retrieve engagement metadata and current status | `lead_auditor`, `co_auditor` |
| `get_coverage` | Get clause-by-clause coverage matrix for an engagement | `lead_auditor`, `co_auditor` |
| `list_candidate_findings` | List engine-drafted candidate findings | `lead_auditor`, `co_auditor` |
| `get_working_paper` | Retrieve working paper content | `lead_auditor`, `co_auditor`, `reviewer` |
| `list_probes` | List available probes for an engagement | `lead_auditor`, `co_auditor` |
| `get_probe_result` | Retrieve probe execution result | `lead_auditor`, `co_auditor` |
| `query_ledger` | Query audit ledger events (read-only) | `lead_auditor` |
| `get_ai_system_profile` | Retrieve AI system inventory entry | `lead_auditor`, `co_auditor` |
| `search_claims` | Semantic search over the claim graph | `lead_auditor`, `co_auditor` |

---

## RBAC

RBAC is enforced by `packages/mcp-tools/src/guards/mcp-auth.guard.ts`.
The guard:

1. Extracts the principal from the MCP session token (same token as the
   web UI session).
2. Resolves the principal's role on the engagement referenced in the
   tool input.
3. Checks the tool's `rbac.requiredRoles` list.
4. Rejects with a signed error receipt if unauthorized.

---

## Signed Receipts

Every tool invocation produces a signed receipt in `.receipts/`:

```json
{
  "receiptVersion": "1",
  "tool": "get_coverage",
  "calledAt": "2026-05-10T14:23:00Z",
  "engagementId": "...",
  "principal": "...",
  "inputHash": "sha256:...",
  "resultHash": "sha256:...",
  "signature": "ed25519:...",
  "keyId": "auditforge-key-001"
}
```

The receipt chain can be audited with the `protect-mcp:audit-chain`
skill, which walks all receipts, verifies signatures, and confirms
hash continuity.

---

## AI System Self-Profile

CLAUDE.md mandates that "AuditForge profiles itself in its own AI
System Inventory (eats own dogfood)." The MCP server exposes a
`get_ai_system_profile` tool that returns AuditForge's own AIMS entry:

- AI system name: AuditForge ISO 42001
- AI system type: AI-assisted audit workbench
- AI models in use: tier-router-configured local and cloud models
- Risk level: high (processes sensitive audit data)
- Responsible person: platform operator
- Compliance status: in scope for ISO 42001 self-assessment

This entry is maintained in `packages/ai-system-profiler/` and updated
on each release.

---

## MCP Server Flow

```
MCP Client → apps/mcp-server → MCPAuthGuard → tool handler
                                             → AuditLedgerService (emit mcp.tool_call)
                                             → NestJS API (internal HTTP)
                                             → ReceiptWriter (sign + write receipt)
                                             → MCP Client (result)
```

See [../diagrams/mcp-server-flow.mmd](../diagrams/mcp-server-flow.mmd).

---

## Cross-References

- [ADR-0016](../adr/0016-mcp-server-scaffold.md) — MCP server design.
- [../developer-guide/08-adding-an-mcp-tool.md](../developer-guide/08-adding-an-mcp-tool.md)
  — adding a new tool.
- `apps/mcp-server/` — server source code.
- `packages/mcp-tools/` — tool registry and guards.
