// SPDX-License-Identifier: BUSL-1.1
import type { McpAuditEntry, McpServerSnapshot } from './P-MCP-shared.js';

const baseEntry: Omit<McpAuditEntry, 'tool' | 'resource' | 'type'> = {
  actorId: 'auth0|user-1',
  verdict: 'allowed',
  occurredAt: '2026-05-03T10:00:00Z',
  latencyMs: 12,
  paramsHash: 'a'.repeat(64),
};

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

export const P_MCP_03_FIXTURES = {
  complete: {
    ...base,
    auditTrail: [
      { ...baseEntry, type: 'tool.invoked', tool: 'list_engagements', resource: null },
      { ...baseEntry, type: 'resource.read', tool: null, resource: 'engagement://e1/findings' },
    ] as readonly McpAuditEntry[],
    sessions: [
      {
        sessionId: 's1', serverId: 'srv-1', principalSub: 'auth0|user-1',
        toolsCalled: ['list_engagements'],
        resourcesRead: ['engagement://e1/findings'],
        contextLeakageDetected: false,
      },
    ],
  } satisfies McpServerSnapshot,

  missingEntries: {
    ...base,
    // Sessions calls but no audit rows.
    sessions: [
      {
        sessionId: 's1', serverId: 'srv-1', principalSub: 'auth0|user-1',
        toolsCalled: ['delete_user'],
        resourcesRead: [],
        contextLeakageDetected: false,
      },
    ],
  } satisfies McpServerSnapshot,

  malformedEntries: {
    ...base,
    auditTrail: [
      { type: 'tool.invoked', tool: 'list_engagements', resource: null,
        actorId: null, verdict: 'allowed', occurredAt: '2026-05-03T10:00:00Z',
        latencyMs: -1, paramsHash: '' },
    ] as readonly McpAuditEntry[],
    sessions: [],
  } satisfies McpServerSnapshot,
} as const;
