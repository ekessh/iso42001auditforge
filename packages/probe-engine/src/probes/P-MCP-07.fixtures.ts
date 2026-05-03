// SPDX-License-Identifier: BUSL-1.1
import type { McpServerSnapshot } from './P-MCP-shared.js';

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
  sessions: [
    { sessionId: 's1', serverId: 'srv-1', principalSub: 'auth0|u', toolsCalled: ['t'], resourcesRead: [], contextLeakageDetected: false },
  ],
};

export const P_MCP_07_FIXTURES = {
  isolated: [base, { ...base, serverId: 'srv-2' }] as readonly McpServerSnapshot[],
  unscoped: [
    { ...base, sessionScopedToServer: false },
    { ...base, serverId: 'srv-2' },
  ] as readonly McpServerSnapshot[],
  leaking: [
    {
      ...base,
      sessions: [{ ...base.sessions[0]!, contextLeakageDetected: true, sessionId: 's-leak' }],
    },
  ] as readonly McpServerSnapshot[],
} as const;
