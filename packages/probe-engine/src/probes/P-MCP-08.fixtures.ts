// SPDX-License-Identifier: BUSL-1.1
import type { McpServerSnapshot } from './P-MCP-shared.js';
import type { GatewayProbeOutcome } from './P-MCP-08.js';

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

export const P_MCP_08_FIXTURES = {
  passing: {
    snapshot: base,
    outcomes: [
      { attemptId: 'a1', expectedVerdict: 'denied', observedVerdict: 'denied', auditRowFound: true },
      { attemptId: 'a2', expectedVerdict: 'denied', observedVerdict: 'denied', auditRowFound: true },
    ] as readonly GatewayProbeOutcome[],
  },
  bypassedDenial: {
    snapshot: base,
    outcomes: [
      { attemptId: 'a1', expectedVerdict: 'denied', observedVerdict: 'allowed', auditRowFound: true },
    ] as readonly GatewayProbeOutcome[],
  },
  silentDenial: {
    snapshot: base,
    outcomes: [
      { attemptId: 'a1', expectedVerdict: 'denied', observedVerdict: 'denied', auditRowFound: false },
    ] as readonly GatewayProbeOutcome[],
  },
  enforcementDisabled: {
    snapshot: { ...base, gatewayPolicyEnforced: false },
    outcomes: [
      { attemptId: 'a1', expectedVerdict: 'denied', observedVerdict: 'denied', auditRowFound: true },
    ] as readonly GatewayProbeOutcome[],
  },
} as const;
