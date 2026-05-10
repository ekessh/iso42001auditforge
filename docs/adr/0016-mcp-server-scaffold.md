# ADR-0016: MCP server scaffold using @modelcontextprotocol/sdk

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core
- **Phase**: 14 (scaffold) → Phase 15 (production wiring)
- **Tags**: mcp, automation, signing, governance

## Context

`CLAUDE.md` lists `apps/mcp-server` as a Phase 15 deliverable: AuditForge as an MCP server, exposing engagement data and operations to MCP-compatible clients (Claude Desktop, Cursor, Copilot Workspace). The CLI tool surface, RBAC matrix, and confirmation-token handling for write operations need to be designed before Phase 15 implements transports — otherwise the LLM-side prompt-engineering and the auditor-side consent UI cannot proceed in parallel.

## Decision

Scaffold `apps/mcp-server` using the official `@modelcontextprotocol/sdk` and freeze the tool surface at thirteen tools across six categories:

- **Engagements**: `list_engagements`, `get_engagement`
- **Findings**: `list_findings`, `get_candidate_findings`
- **Coverage**: `get_coverage_state`, `summarize_engagement`
- **Library / claims**: `library.search`, `search_claims`, `draft_followup_question`
- **Working papers**: `working-paper.read` (read-only — write tools deferred)
- **Reports**: `report.list`, `report.publish`
- **Self-profile**: `aiSystemInventory.profile`

Typed Zod schemas live in a shared workspace package, `@auditforge/mcp-tools`, so future internal MCP clients can consume the same descriptors without duplicating definitions. Per-tool RBAC mirrors the v2 auth-core role system; cross-tenant access is impossible by construction (the principal's `engagements[]` is firm-scoped at token-issue time).

`report.publish` is the **only** state-mutating tool. It requires:

1. Lead-auditor role.
2. A single-use `confirmationToken` minted by the web UI consent flow.
3. An Ed25519-signed receipt produced via `@auditforge/signing`'s `SoftwareSigningProvider`. The receipt includes the canonicalized payload, key id, and signature, all surfaced to the caller and emitted to the audit ledger.

`aiSystemInventory.profile` returns the AuditForge MCP server's own model card — modelName `auditforge-mcp`, capabilities, limitations, governance metadata — satisfying the `CLAUDE.md` hard rule that "AuditForge profiles itself in its own AI System Inventory."

## Consequences

### Positive

- **Frozen tool surface**: Prompt engineers and the consent-UI team can design against a stable contract before transports exist.
- **No-write-by-default**: The only path to mutation is `report.publish` with confirmation. Auditor consent is mandatory and cryptographically attested.
- **Anti-tool-poisoning**: Each tool's `{name, description, inputSchema}` triple is fingerprinted (SHA-256) at module load; bumping a description requires a server-version bump, caught by P-MCP-01 probe.
- **Reusable descriptors**: `@auditforge/mcp-tools` provides `toSdkTool()` so descriptors plug into any MCP-SDK consumer.

### Negative

- **Larger Phase 15 scope**: Real MCP transport (Streamable HTTP + stdio for Claude Desktop), receipt persistence, and OAuth integration must follow.
- **Receipt key management**: The Ed25519 key needs HSM/KMS provisioning in production, not a software signer; tracked in Phase 15 follow-ups.

### Neutral

- The thirteenth tool (`aiSystemInventory.profile`) is unusual but mandated by the AI System Inventory dogfooding rule.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Build our own JSON-RPC server | Loses MCP client compatibility; reinvents transport, auth handshake, and tool discovery. |
| Expose write tools without confirmation tokens | Violates `engine outputs are drafts; auditor confirmation is the only state-transition trigger`. |
| Skip `aiSystemInventory.profile` | `CLAUDE.md` hard rule: AuditForge profiles itself. Non-negotiable. |
| Hot-reload tool descriptions | Anti-pattern per the P-MCP-01 research. Pinned + fingerprint-checked is the safer default. |

## Compliance Implications

- **ISO 42001 A.6.2** — AI System Inventory: `aiSystemInventory.profile` is the inventory entry for AuditForge's own MCP service.
- **ISO 42001 Clause 9.1** — Performance evaluation: every tool invocation emits an audit-ledger event; `llm_invocations` rows are written for tools that hit the conversational engine.
- **ISO 17021-1** — Audit independence: no MCP client can promote a candidate finding to a formal Finding without the existing signed-report flow.
- **EU AI Act Art. 14** (human oversight): `report.publish` requires explicit confirmation tokens minted via the human-driven web UI.

## Follow-Ups

- [ ] Phase 15: Streamable HTTP transport + stdio transport for local Claude Desktop.
- [ ] Phase 15: OAuth flow → Principal mapping (currently `StaticPrincipalAuthGateway` for tests).
- [ ] Phase 15: Migrate `SoftwareSigningProvider` to PKCS#11/KMS for production.
- [ ] Phase 15: Implement P-MCP-01 ... P-MCP-08 probes against the running server.
- [ ] Phase 15: Persist receipts in `audit_ledger` and surface them in the auditor "What did the agent do?" UI.
