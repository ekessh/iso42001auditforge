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
  sessions: [],
};

export const P_MCP_04_FIXTURES = {
  oauth: { ...base, authMode: 'oauth' } as McpServerSnapshot,
  mtls: { ...base, authMode: 'mtls' } as McpServerSnapshot,
  staticSecret: { ...base, authMode: 'static-secret' } as McpServerSnapshot,
  none: { ...base, authMode: 'none' } as McpServerSnapshot,
} as const;
