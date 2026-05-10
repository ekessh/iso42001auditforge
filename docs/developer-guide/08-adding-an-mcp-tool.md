<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - apps/mcp-server/
  - packages/mcp-tools/
  - docs/concepts/mcp-server.md
-->

# Adding an MCP Tool

> How to add a new tool to the AuditForge MCP server.

---

## MCP Tool Requirements

Every MCP tool in AuditForge must:

1. Be registered in the tool registry with a name, description, and
   JSON schema for its input.
2. Have RBAC constraints: which roles can call it, and in which
   engagement context.
3. Produce a signed receipt in `.receipts/` for every invocation.
4. Emit a `mcp.tool_call` audit ledger event.
5. Have a unit test and an MCP integration test.

---

## Step 1: Tool Registration

Add the tool to `packages/mcp-tools/src/tools/my-tool.ts`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import type { MCPToolDefinition } from '../types';

export const myTool: MCPToolDefinition = {
  name: 'get_my_data',
  description: 'Retrieves X for the current engagement.',
  inputSchema: {
    type: 'object',
    properties: {
      engagementId: { type: 'string', format: 'uuid' },
    },
    required: ['engagementId'],
  },
  rbac: {
    requiredRoles: ['lead_auditor', 'co_auditor'],
    engagementScoped: true,
  },
};
```

Export from `packages/mcp-tools/src/tools/index.ts`.

---

## Step 2: Tool Handler

Add the handler in `apps/mcp-server/src/tools/my-tool.handler.ts`:

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { AuditLedgerService } from '@auditforge/audit-engine';
import { ReceiptWriter } from '@auditforge/mcp-tools';

@Injectable()
export class MyToolHandler {
  constructor(
    private readonly ledger: AuditLedgerService,
    private readonly receipts: ReceiptWriter,
  ) {}

  async handle(input: { engagementId: string }, ctx: MCPCallContext) {
    // 1. Perform the work
    const data = await this.fetchData(input.engagementId);

    // 2. Emit ledger event
    await this.ledger.emit({
      type: 'mcp.tool_call',
      payload: { tool: 'get_my_data', input, principal: ctx.principal },
      tenantId: ctx.tenantId,
    });

    // 3. Write signed receipt
    await this.receipts.write({
      tool: 'get_my_data',
      input,
      result: data,
      principal: ctx.principal,
    });

    return data;
  }
}
```

Register the handler in `apps/mcp-server/src/app.module.ts`.

---

## Step 3: RBAC Check

RBAC is enforced by the `MCPAuthGuard` in `packages/mcp-tools/src/guards/`.
The guard reads `tool.rbac.requiredRoles` and rejects the call with a
signed error receipt if the principal lacks the required role.

The guard also checks `engagementScoped` — if `true`, the engagement
ID in the input must be an engagement the principal belongs to (checked
via `packages/engagement`).

---

## Step 4: Receipt Signing

Receipts are Ed25519-signed JSON files written to `.receipts/`:

```json
{
  "tool": "get_my_data",
  "calledAt": "2026-05-10T14:00:00Z",
  "principal": "auditor-uuid",
  "input": { "engagementId": "..." },
  "resultHash": "sha256:...",
  "signature": "ed25519:..."
}
```

The `protect-mcp:audit-chain` skill can walk the receipt chain to
verify all receipts are intact and unmodified.

---

## Step 5: Tests

```typescript
// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { createMCPTestClient } from '../helpers/mcp-client';

describe('get_my_data MCP tool', () => {
  it('returns data for an authorized auditor', async () => {
    const client = await createMCPTestClient({ role: 'lead_auditor' });
    const result = await client.callTool('get_my_data', {
      engagementId: testEngagementId,
    });
    expect(result.content).toBeDefined();
  });

  it('rejects an unauthorized caller', async () => {
    const client = await createMCPTestClient({ role: 'auditee' });
    await expect(
      client.callTool('get_my_data', { engagementId: testEngagementId })
    ).rejects.toThrow('permission denied');
  });
});
```

---

## Cross-References

- [../concepts/mcp-server.md](../concepts/mcp-server.md) — MCP server
  architecture.
- [../diagrams/mcp-server-flow.mmd](../diagrams/mcp-server-flow.mmd)
  — sequence diagram.
- `packages/mcp-tools/` — tool registry and guards source.
