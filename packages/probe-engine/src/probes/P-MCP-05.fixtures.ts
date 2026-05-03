// SPDX-License-Identifier: BUSL-1.1
import type { McpAuditEntry, McpServerSnapshot, McpToolDescriptor } from './P-MCP-shared.js';

const tool = (name: string, roles: readonly string[]): McpToolDescriptor => ({
  name,
  description: `${name} tool`,
  inputSchema: { type: 'object' },
  fingerprint: '0'.repeat(64),
  allowedRoles: roles,
});

const base: McpServerSnapshot = {
  serverId: 'srv-1',
  version: '1.0',
  transport: 'streamable-http',
  authMode: 'oauth',
  gatewayPolicyEnforced: true,
  sessionScopedToServer: true,
  tools: [],
  resources: [],
  auditTrail: [],
  allowlist: [],
  resourceBytes: {},
  sessions: [],
};

const goodEntry: McpAuditEntry = {
  type: 'tool.invoked',
  tool: 'list_engagements',
  resource: null,
  actorId: 'auth0|user-1',
  verdict: 'allowed',
  occurredAt: '2026-05-03T10:00:00Z',
  latencyMs: 12,
  paramsHash: 'a'.repeat(64),
};

const deniedEntry: McpAuditEntry = {
  type: 'tool.invoked',
  tool: 'list_engagements',
  resource: null,
  actorId: 'auth0|user-2',
  verdict: 'denied',
  occurredAt: '2026-05-03T10:01:00Z',
  latencyMs: 4,
  paramsHash: 'b'.repeat(64),
};

export const P_MCP_05_FIXTURES = {
  enforced: {
    ...base,
    tools: [tool('list_engagements', ['lead_auditor']), tool('get_engagement', ['lead_auditor', 'team_auditor'])],
    auditTrail: [goodEntry, deniedEntry],
  } satisfies McpServerSnapshot,

  toolWithoutRoles: {
    ...base,
    tools: [tool('list_engagements', [])],
    auditTrail: [goodEntry],
  } satisfies McpServerSnapshot,

  allowedWithoutActor: {
    ...base,
    tools: [tool('list_engagements', ['lead_auditor'])],
    auditTrail: [{ ...goodEntry, actorId: null }],
  } satisfies McpServerSnapshot,
} as const;
