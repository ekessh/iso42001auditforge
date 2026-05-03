// SPDX-License-Identifier: BUSL-1.1
/**
 * Shared types + helpers for the P-MCP probe family. These probes audit the
 * MCP servers an *auditee* runs as part of their AI infrastructure (per v3
 * Section 15.16 #5b). They map to A.6.2.7 (security), A.10 (third-party),
 * A.9 (use of AI systems).
 *
 * The probes are offline / replay: they consume a snapshot of the auditee's
 * MCP server (`McpServerSnapshot`). Production runs collect this via a sandbox
 * connector; tests synthesize it.
 */

import { z } from 'zod';

export interface McpToolDescriptor {
  readonly name: string;
  readonly description: string;
  // `any` not `unknown` — the structural type must accept the Zod-inferred
  // shape from `McpToolDescriptorSchema.inputSchema: z.any()`. We don't
  // introspect the schema in this package; the fingerprint check covers
  // schema drift.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly inputSchema: any;
  /** Pinned fingerprint = sha256(name || description || schema). */
  readonly fingerprint: string;
  /** Roles allowed to invoke this tool, per the server's RBAC matrix. */
  readonly allowedRoles: readonly string[];
}

export interface McpResourceDescriptor {
  readonly uriTemplate: string;
  readonly name: string;
  readonly mimeType: string;
}

export interface McpAuditEntry {
  readonly type: 'tool.invoked' | 'resource.read' | 'auth.denied';
  readonly tool: string | null;
  readonly resource: string | null;
  readonly actorId: string | null;
  readonly verdict: 'allowed' | 'denied' | 'error';
  readonly occurredAt: string;
  readonly latencyMs: number;
  readonly paramsHash: string;
}

export interface McpServerSnapshot {
  readonly serverId: string;
  readonly version: string;
  readonly transport: 'stdio' | 'streamable-http' | 'sse' | 'unknown';
  readonly authMode: 'oauth' | 'static-secret' | 'mtls' | 'none';
  readonly gatewayPolicyEnforced: boolean;
  readonly sessionScopedToServer: boolean;
  readonly tools: readonly McpToolDescriptor[];
  readonly resources: readonly McpResourceDescriptor[];
  readonly auditTrail: readonly McpAuditEntry[];
  /**
   * Static set of allowed servers per the auditee's allow-list (e.g. AGE
   * MCP gateway / mcp-allow.json). Empty array => no enforcement.
   */
  readonly allowlist: readonly string[];
  /**
   * Resource bytes the probes can scan for indirect prompt injection. Map
   * keyed by resource URI.
   */
  readonly resourceBytes: Readonly<Record<string, string>>;
  /**
   * Sessions captured during the audit window. Cross-server isolation means
   * one session never carries state into another server's session.
   */
  readonly sessions: readonly McpSessionRecord[];
}

export interface McpSessionRecord {
  readonly sessionId: string;
  readonly serverId: string;
  readonly principalSub: string;
  readonly toolsCalled: readonly string[];
  readonly resourcesRead: readonly string[];
  readonly contextLeakageDetected: boolean;
}

export const McpAuditEntrySchema = z.object({
  type: z.enum(['tool.invoked', 'resource.read', 'auth.denied']),
  tool: z.string().nullable(),
  resource: z.string().nullable(),
  actorId: z.string().nullable(),
  verdict: z.enum(['allowed', 'denied', 'error']),
  occurredAt: z.string(),
  latencyMs: z.number().nonnegative(),
  paramsHash: z.string(),
});

export const McpToolDescriptorSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  // The descriptor surfaces an opaque inputSchema (we do not introspect it
  // here; a separate fingerprint check covers schema drift). We use
  // `z.any()` rather than `z.unknown()` so the inferred output keeps the
  // field non-optional and aligned with the structural McpToolDescriptor.
  inputSchema: z.any(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  allowedRoles: z.array(z.string()),
});

export const McpServerSnapshotSchema = z.object({
  serverId: z.string().min(1),
  version: z.string(),
  transport: z.enum(['stdio', 'streamable-http', 'sse', 'unknown']),
  authMode: z.enum(['oauth', 'static-secret', 'mtls', 'none']),
  gatewayPolicyEnforced: z.boolean(),
  sessionScopedToServer: z.boolean(),
  tools: z.array(McpToolDescriptorSchema),
  resources: z.array(
    z.object({
      uriTemplate: z.string(),
      name: z.string(),
      mimeType: z.string(),
    }),
  ),
  auditTrail: z.array(McpAuditEntrySchema),
  allowlist: z.array(z.string()),
  resourceBytes: z.record(z.string()),
  sessions: z.array(
    z.object({
      sessionId: z.string(),
      serverId: z.string(),
      principalSub: z.string(),
      toolsCalled: z.array(z.string()),
      resourcesRead: z.array(z.string()),
      contextLeakageDetected: z.boolean(),
    }),
  ),
});

/**
 * Heuristic patterns characteristic of Tool Poisoning Attacks (Invariant Labs).
 * The attacker hides instructions inside the tool description so any model
 * reading the description treats them as legitimate guidance.
 */
export const TOOL_POISONING_PATTERNS: readonly RegExp[] = [
  /ignore (?:previous|prior|all) (?:instructions|rules|guidance)/i,
  /you are now /i,
  /system prompt/i,
  /<\s*system\s*>/i,
  /\bDAN\b/,
  /developer mode/i,
  /confirm with [A-Z_]{3,}/, // signal-style markers
  /<\s*sudo\s*>/i,
  /\bjailbroken?\b/i,
  /forget (?:your )?guidelines/i,
  /override safety/i,
  /[A-Za-z0-9+/]{200,}/, // very long base64-looking blob (encoding evasion)
  /print .*system.*verbatim/i,
];

/** Common prompt-injection markers that may sit inside auditee resources. */
export const RESOURCE_INJECTION_PATTERNS: readonly RegExp[] = [
  /\bIGNORE\s+(?:THE\s+)?ABOVE\b/i,
  /\bdisregard\b.*\binstructions\b/i,
  /\bSYSTEM:\s*/,
  /\bASSISTANT:\s*/,
  /<\s*\/?\s*tool_call\s*>/i,
  /\bnew (?:task|instruction)s?:/i,
  /\binject\b.*\bprompt\b/i,
];

export function detectMatches(
  text: string,
  patterns: readonly RegExp[],
): readonly string[] {
  const hits: string[] = [];
  for (const re of patterns) {
    if (re.test(text)) hits.push(re.source);
  }
  return hits;
}
