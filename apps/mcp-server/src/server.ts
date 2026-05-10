// SPDX-License-Identifier: BUSL-1.1
/**
 * AuditForge MCP server.
 *
 * Per v3 Section 15.16 #5 + Section 18.5: Streamable HTTP transport
 * (handler-only here — concrete HTTP wiring lives in `start()` and is
 * pluggable for tests), OAuth-integrated auth, structured audit logging,
 * MCP gateway pattern, per-tool RBAC matching v2 roles.
 *
 * The server exposes three operations:
 *   - listTools()      → tool discovery
 *   - callTool(req)    → tool dispatch (auth, RBAC, audit, schema validate)
 *   - readResource(req)→ resource read (same auth/RBAC pipeline)
 *
 * Concrete `@modelcontextprotocol/sdk` server wiring is in `bindMcpSdk()` for
 * production; tests drive the dispatcher directly.
 */

import { z } from 'zod';

import { LedgerEmitter, hashParams, nullLogger } from './audit.js';
import { authorizeTool, isToolKnown } from './rbac.js';
import { ALL_TOOLS, ToolError, toolByName } from './tools/index.js';
import {
  RESOURCE_ASPECTS,
  RESOURCE_TOOL_FOR,
  parseResourceUri,
  readResource,
} from './resources/index.js';
import type {
  AuditDataPort,
  AuditLedgerSink,
  McpLogger,
  Principal,
} from './types.js';
import type { AuthGateway } from './auth.js';
import { AuthError } from './auth.js';
import type { McpReceiptSigner } from './signing.js';

export interface McpServerOpts {
  readonly auth: AuthGateway;
  readonly data: AuditDataPort;
  readonly ledger: AuditLedgerSink;
  readonly logger?: McpLogger;
  readonly now?: () => Date;
  readonly receiptSigner?: McpReceiptSigner | null;
  /**
   * Server version. Tool fingerprints + this version are pinned together;
   * bumping descriptions requires a version bump (anti-tool-poisoning).
   */
  readonly version?: string;
}

export interface ToolListEntry {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly fingerprint: string;
}

export interface ResourceListEntry {
  readonly uriTemplate: string;
  readonly name: string;
  readonly mimeType: 'application/json';
}

export interface CallToolRequest {
  readonly authorization: string | null | undefined;
  readonly toolName: string;
  readonly args: unknown;
}

export interface CallToolResponse {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface ReadResourceRequest {
  readonly authorization: string | null | undefined;
  readonly uri: string;
}

export interface ReadResourceResponse {
  readonly ok: boolean;
  readonly content?: { readonly uri: string; readonly mimeType: string; readonly text: string };
  readonly error?: { readonly code: string; readonly message: string };
}

export class McpServer {
  private readonly auth: AuthGateway;
  private readonly data: AuditDataPort;
  private readonly logger: McpLogger;
  private readonly emitter: LedgerEmitter;
  private readonly now: () => Date;
  private readonly receiptSigner: McpReceiptSigner | null;
  readonly version: string;

  constructor(opts: McpServerOpts) {
    this.auth = opts.auth;
    this.data = opts.data;
    this.logger = opts.logger ?? nullLogger;
    this.now = opts.now ?? (() => new Date());
    this.emitter = new LedgerEmitter(opts.ledger, this.logger, this.now);
    this.version = opts.version ?? '0.1.0';
    this.receiptSigner = opts.receiptSigner ?? null;
  }

  listTools(): readonly ToolListEntry[] {
    return ALL_TOOLS.map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      inputSchema: zodToJsonSchemaShallow(t.definition.inputSchema),
      fingerprint: t.definition.fingerprint,
    }));
  }

  listResources(): readonly ResourceListEntry[] {
    return RESOURCE_ASPECTS.map((a) => ({
      uriTemplate: `engagement://{id}/${a}`,
      name: a,
      mimeType: 'application/json',
    }));
  }

  async callTool(req: CallToolRequest): Promise<CallToolResponse> {
    const t0 = Date.now();
    let principal: Principal;
    try {
      principal = await this.auth.verify(req.authorization);
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'mcp.auth.unknown';
      await this.emitter.emitAuthDenied({
        tool: req.toolName,
        resource: null,
        errorCode: code,
        latencyMs: Date.now() - t0,
      });
      return { ok: false, error: { code, message: err instanceof Error ? err.message : 'auth failed' } };
    }

    if (!isToolKnown(req.toolName)) {
      await this.emitter.emitToolEvent({
        tool: req.toolName,
        principalSub: principal.sub,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId: null,
        paramsHash: hashParams(req.args),
        verdict: 'denied',
        errorCode: 'mcp.unknown_tool',
        latencyMs: Date.now() - t0,
      });
      return { ok: false, error: { code: 'mcp.unknown_tool', message: `unknown tool: ${req.toolName}` } };
    }

    const handler = toolByName(req.toolName);
    if (!handler) {
      // Should not happen — isToolKnown matches the registry.
      return { ok: false, error: { code: 'mcp.internal', message: 'tool registry inconsistent' } };
    }

    let parsed: unknown;
    try {
      parsed = handler.definition.inputSchema.parse(req.args);
    } catch (err) {
      const message = err instanceof z.ZodError ? err.message : 'invalid arguments';
      await this.emitter.emitToolEvent({
        tool: req.toolName,
        principalSub: principal.sub,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId: null,
        paramsHash: hashParams(req.args),
        verdict: 'error',
        errorCode: 'mcp.bad_arguments',
        latencyMs: Date.now() - t0,
      });
      return { ok: false, error: { code: 'mcp.bad_arguments', message } };
    }

    const engagementId = handler.engagementOf(parsed);
    const auth = authorizeTool(req.toolName, principal, engagementId);
    if (!auth.allowed) {
      await this.emitter.emitToolEvent({
        tool: req.toolName,
        principalSub: principal.sub,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId,
        paramsHash: hashParams(parsed),
        verdict: 'denied',
        errorCode: auth.errorCode ?? 'mcp.rbac.forbidden',
        latencyMs: Date.now() - t0,
      });
      return {
        ok: false,
        error: {
          code: auth.errorCode ?? 'mcp.rbac.forbidden',
          message: auth.reason ?? 'forbidden',
        },
      };
    }

    try {
      const result = await handler.handle(principal, parsed, {
        data: this.data,
        serverVersion: this.version,
        receiptSigner: this.receiptSigner,
        emitLlm: (entry) =>
          this.emitter.emitLlmInvocation({
            engagementId: entry.engagementId,
            purpose: entry.purpose,
            model: entry.model,
            tier: entry.tier,
            tokensIn: entry.tokensIn,
            tokensOut: entry.tokensOut,
            latencyMs: entry.latencyMs,
            costUsd: entry.costUsd,
          }),
      });
      // Validate the output against the declared schema to catch handler bugs.
      // (Strictly optional, but we get it for free and want to fail loud.)
      handler.definition.outputSchema.parse(result);
      await this.emitter.emitToolEvent({
        tool: req.toolName,
        principalSub: principal.sub,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId,
        paramsHash: hashParams(parsed),
        verdict: 'allowed',
        errorCode: null,
        latencyMs: Date.now() - t0,
      });
      return { ok: true, result };
    } catch (err) {
      const code =
        err instanceof ToolError
          ? err.code
          : err instanceof z.ZodError
            ? 'mcp.bad_output'
            : 'mcp.tool.error';
      await this.emitter.emitToolEvent({
        tool: req.toolName,
        principalSub: principal.sub,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId,
        paramsHash: hashParams(parsed),
        verdict: 'error',
        errorCode: code,
        latencyMs: Date.now() - t0,
      });
      return {
        ok: false,
        error: { code, message: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  async readResourceRequest(req: ReadResourceRequest): Promise<ReadResourceResponse> {
    const t0 = Date.now();
    let principal: Principal;
    try {
      principal = await this.auth.verify(req.authorization);
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'mcp.auth.unknown';
      await this.emitter.emitAuthDenied({
        tool: null,
        resource: req.uri,
        errorCode: code,
        latencyMs: Date.now() - t0,
      });
      return { ok: false, error: { code, message: err instanceof Error ? err.message : 'auth failed' } };
    }

    const parsed = parseResourceUri(req.uri);
    if (!parsed) {
      await this.emitter.emitResourceEvent({
        resource: req.uri,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId: null,
        verdict: 'error',
        errorCode: 'mcp.bad_uri',
        latencyMs: Date.now() - t0,
      });
      return { ok: false, error: { code: 'mcp.bad_uri', message: `malformed resource uri: ${req.uri}` } };
    }

    const toolName = RESOURCE_TOOL_FOR[parsed.aspect];
    const auth = authorizeTool(toolName, principal, parsed.engagementId);
    if (!auth.allowed) {
      await this.emitter.emitResourceEvent({
        resource: req.uri,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId: parsed.engagementId,
        verdict: 'denied',
        errorCode: auth.errorCode ?? 'mcp.rbac.forbidden',
        latencyMs: Date.now() - t0,
      });
      return {
        ok: false,
        error: {
          code: auth.errorCode ?? 'mcp.rbac.forbidden',
          message: auth.reason ?? 'forbidden',
        },
      };
    }

    try {
      const content = await readResource(req.uri, principal, this.data);
      await this.emitter.emitResourceEvent({
        resource: req.uri,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId: parsed.engagementId,
        verdict: 'allowed',
        errorCode: null,
        latencyMs: Date.now() - t0,
      });
      return { ok: true, content };
    } catch (err) {
      await this.emitter.emitResourceEvent({
        resource: req.uri,
        auditorId: principal.auditorId,
        firmId: principal.firmId,
        tokenId: principal.tokenId,
        engagementId: parsed.engagementId,
        verdict: 'error',
        errorCode: 'mcp.resource.error',
        latencyMs: Date.now() - t0,
      });
      return {
        ok: false,
        error: { code: 'mcp.resource.error', message: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}

/**
 * Build the server with default deps. Used by both production wiring and
 * tests; tests just substitute the auth + data + ledger ports.
 */
export function createMcpServer(opts: McpServerOpts): McpServer {
  return new McpServer(opts);
}

/**
 * Bind to the @modelcontextprotocol/sdk Server (Streamable HTTP transport).
 * Stub used at runtime; the actual SDK is loaded in `start()` to avoid
 * requiring it during unit tests.
 */
export interface SdkBinding {
  readonly handleListTools: () => readonly ToolListEntry[];
  readonly handleListResources: () => readonly ResourceListEntry[];
  readonly handleCallTool: (req: CallToolRequest) => Promise<CallToolResponse>;
  readonly handleReadResource: (req: ReadResourceRequest) => Promise<ReadResourceResponse>;
}

export function bindMcpSdk(server: McpServer): SdkBinding {
  return {
    handleListTools: () => server.listTools(),
    handleListResources: () => server.listResources(),
    handleCallTool: (req) => server.callTool(req),
    handleReadResource: (req) => server.readResourceRequest(req),
  };
}

/** Very-shallow Zod-to-JSON-Schema translation. Sufficient for tools/list. */
function zodToJsonSchemaShallow(s: z.ZodType<unknown>): unknown {
  const def = (s as unknown as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodType<unknown>> } })._def;
  if (def?.typeName === 'ZodObject' && typeof def.shape === 'function') {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(shape)) {
      const ctn = (v as unknown as { _def?: { typeName?: string } })._def?.typeName ?? 'unknown';
      properties[k] = { type: jsonSchemaType(ctn) };
    }
    return { type: 'object', properties, additionalProperties: false };
  }
  return { type: 'object' };
}

function jsonSchemaType(zodTypeName: string): string {
  switch (zodTypeName) {
    case 'ZodString':
    case 'ZodEnum':
    case 'ZodNativeEnum':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    default:
      return 'string';
  }
}
