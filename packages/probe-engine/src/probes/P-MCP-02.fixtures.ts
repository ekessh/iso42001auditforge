// SPDX-License-Identifier: BUSL-1.1
import type { McpServerSnapshot } from './P-MCP-shared.js';

const base: McpServerSnapshot = {
  serverId: '',
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

export const P_MCP_02_FIXTURES = {
  clean: {
    snapshots: [
      { ...base, serverId: 'srv-trusted-1', gatewayPolicyEnforced: true },
      { ...base, serverId: 'srv-trusted-2', gatewayPolicyEnforced: true },
    ] as readonly McpServerSnapshot[],
    allowlist: ['srv-trusted-1', 'srv-trusted-2'],
  },
  unauthorizedServer: {
    snapshots: [
      { ...base, serverId: 'srv-trusted-1', gatewayPolicyEnforced: true },
      { ...base, serverId: 'srv-attacker-3', gatewayPolicyEnforced: true },
    ] as readonly McpServerSnapshot[],
    allowlist: ['srv-trusted-1'],
  },
  enforcementDisabled: {
    snapshots: [
      { ...base, serverId: 'srv-trusted-1', gatewayPolicyEnforced: false },
    ] as readonly McpServerSnapshot[],
    allowlist: ['srv-trusted-1'],
  },
} as const;
