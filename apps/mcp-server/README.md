# @auditforge/mcp-server

AuditForge as an MCP server. Exposes engagement data, working papers, candidate findings, claims, and coverage state via the Model Context Protocol so lead auditors can operate on audit data from Claude Desktop, Cursor, Copilot Workspace, or any MCP-compatible client.

License: BUSL-1.1.

## Status

Phase 15 deliverable per `v3.md` Section 15.16 #5 + Section 18.5. Designed for the 2026 MCP spec (Streamable HTTP transport, OAuth-integrated auth, structured audit logging, MCP gateway pattern).

## Tools (8)

| Tool | RBAC roles |
|------|------------|
| `list_engagements` | `lead_auditor`, `firm_admin` |
| `get_engagement` | anyone with engagement access (membership-checked) |
| `list_findings` | `lead_auditor`, `team_auditor`, `peer_reviewer` |
| `get_candidate_findings` | `lead_auditor` only |
| `get_coverage_state` | `lead_auditor`, `audit_manager` |
| `draft_followup_question` | `lead_auditor` (calls conversational-engine internally) |
| `summarize_engagement` | `lead_auditor`, `firm_admin` |
| `search_claims` | `lead_auditor`, `technical_expert` |

## Resources

- `engagement://{id}/working-papers`
- `engagement://{id}/findings`
- `engagement://{id}/candidate-findings`
- `engagement://{id}/claims`
- `engagement://{id}/coverage`

## Auth

- OAuth 2.1 with PKCE per the 2026 MCP roadmap. No static secrets.
- Access tokens carry `sub` (auditor), `engagements[]`, `roles[]`.
- A pluggable `AuthGateway` validates tokens against the auditor's IdP.
- Air-gapped builds inject a static `AirGappedAuthGateway` (file-based JWKs).

## Audit logging

Every request emits two structured events:

1. `llm_invocations` row (when the tool calls the conversational engine).
2. `audit ledger` event (`mcp.tool.invoked`) with `actorId`, `engagementId`, `tool`, `paramsHash`, `verdict`, `latencyMs`.

The ledger sink is injected as a port (`AuditLedgerSink`) so tests can capture events.

## Transport

Streamable HTTP (per 2026 spec). The transport layer is pluggable; for tests we use an in-memory transport.

## Notes

- Cross-tenant access is denied at three layers: token claims, RBAC, RLS-equivalent membership check.
- Tool input/output schemas are Zod-validated before dispatch.
- Tool descriptions are pinned: changing them requires bumping the server version (anti-tool-poisoning).
