// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const ExternalSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type ExternalSeverity = z.infer<typeof ExternalSeveritySchema>;

export const ExternalCheckOutcomeSchema = z.enum([
  'pass',
  'fail',
  'error',
  'terminated_by_budget',
]);
export type ExternalCheckOutcome = z.infer<typeof ExternalCheckOutcomeSchema>;

export const ExternalRunStateSchema = z.enum([
  'queued',
  'running',
  'complete',
  'error',
  'cancelled',
]);
export type ExternalRunState = z.infer<typeof ExternalRunStateSchema>;

export const ExternalTargetKindSchema = z.enum(['http', 'openai_compatible', 'anthropic', 'mcp']);
export type ExternalTargetKind = z.infer<typeof ExternalTargetKindSchema>;

export const ExternalTargetSchema = z.object({
  kind: ExternalTargetKindSchema,
  endpoint: z.string().min(1),
  headers: z.record(z.string()).optional(),
  model: z.string().optional(),
  auth_token_env: z.string().optional(),
});
export type ExternalTarget = z.infer<typeof ExternalTargetSchema>;

export const ExternalBudgetSchema = z.object({
  max_seconds: z.number().positive().max(3600),
  max_calls: z.number().int().positive().max(100_000),
  max_tokens: z.number().int().positive().max(100_000_000),
  max_usd: z.number().nonnegative().max(10_000),
});
export type ExternalBudget = z.infer<typeof ExternalBudgetSchema>;

export const ExternalSandboxSchema = z.object({
  network_allowlist: z.array(z.string()).default([]),
  egress_proxy: z.string().optional(),
  fs_root: z.string().optional(),
});
export type ExternalSandbox = z.infer<typeof ExternalSandboxSchema>;

export const ExternalFindingSchema = z.object({
  finding_id: z.string(),
  severity: ExternalSeveritySchema,
  title: z.string(),
  description: z.string(),
  signal_kind: z.string(),
  evidence_pointers: z.array(z.string()).default([]),
});
export type ExternalFinding = z.infer<typeof ExternalFindingSchema>;

export const ExternalMetricsSchema = z.object({
  calls: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
  usd: z.number().nonnegative(),
  wall_seconds: z.number().nonnegative(),
});
export type ExternalMetrics = z.infer<typeof ExternalMetricsSchema>;

export const ExternalArtifactRefSchema = z.object({
  relative_path: z.string(),
  content_type: z.string(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ExternalArtifactRef = z.infer<typeof ExternalArtifactRefSchema>;

export const ExternalCheckResultSchema = z.object({
  run_id: z.string(),
  check_id: z.string(),
  status: ExternalCheckOutcomeSchema,
  severity: ExternalSeveritySchema,
  findings: z.array(ExternalFindingSchema).default([]),
  metrics: ExternalMetricsSchema,
  evidence_artifacts: z.array(ExternalArtifactRefSchema).default([]),
  timestamp_iso: z.string(),
  terminated_by_budget: z.boolean().default(false),
  signature: z.string().nullable().optional(),
  signature_algorithm: z.string().nullable().optional(),
  signature_signer_id: z.string().nullable().optional(),
});
export type ExternalCheckResult = z.infer<typeof ExternalCheckResultSchema>;

export const ExternalRunStatusSchema = z.object({
  run_id: z.string(),
  check_id: z.string(),
  state: ExternalRunStateSchema,
  started_at: z.string(),
  updated_at: z.string(),
  metrics: ExternalMetricsSchema,
  partial_findings: z.array(ExternalFindingSchema).default([]),
  result: ExternalCheckResultSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});
export type ExternalRunStatus = z.infer<typeof ExternalRunStatusSchema>;

export const ExternalCatalogueEntrySchema = z.object({
  id: z.string(),
  category: z.enum(['AC', 'MCP']),
  family: z.string(),
  severity: ExternalSeveritySchema,
  title: z.string(),
  description: z.string(),
  inputs_schema: z.record(z.unknown()),
  outputs_schema: z.record(z.unknown()),
  iso42001_clauses: z.array(z.string()).default([]),
  annex_a: z.array(z.string()).default([]),
  external_refs: z.array(z.record(z.string())).default([]),
});
export type ExternalCatalogueEntry = z.infer<typeof ExternalCatalogueEntrySchema>;

const RunCreatedSchema = z.object({ run_id: z.string() });

export interface ExternalRunnerStartArgs {
  readonly checkId: string;
  readonly target: ExternalTarget;
  readonly params?: Record<string, unknown>;
  readonly budget: ExternalBudget;
  readonly sandbox?: ExternalSandbox;
  readonly engagementContextJwt: string;
}

export interface ExternalRunnerStreamEvent {
  readonly event: string;
  readonly data: unknown;
}

export interface ExternalRunnerOptions {
  /** Base URL of the audit-evidence-runner sidecar e.g. `http://127.0.0.1:8088`. */
  readonly baseUrl: string;
  /** Optional bearer token for an API gateway in front of the sidecar. */
  readonly authToken?: string;
  /** Defaults to `globalThis.fetch`. Test code injects a stub. */
  readonly fetchImpl?: typeof fetch;
  /** Default request timeout (ms). */
  readonly timeoutMs?: number;
}

export class ExternalAuditEvidenceRunnerError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`audit-evidence-runner returned HTTP ${status}`);
    this.name = 'ExternalAuditEvidenceRunnerError';
  }
}

export class ExternalAuditEvidenceRunner {
  private readonly baseUrl: string;
  private readonly authToken: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: ExternalRunnerOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.authToken = opts.authToken;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async catalogue(): Promise<ExternalCatalogueEntry[]> {
    const json = await this.json('GET', '/checks/catalogue');
    return z.array(ExternalCatalogueEntrySchema).parse(json);
  }

  async start(args: ExternalRunnerStartArgs): Promise<string> {
    const body = {
      check_id: args.checkId,
      target: args.target,
      params: args.params ?? {},
      budget: args.budget,
      sandbox: args.sandbox ?? { network_allowlist: [] },
      engagement_context: args.engagementContextJwt,
    };
    const json = await this.json('POST', '/checks/run', body);
    return RunCreatedSchema.parse(json).run_id;
  }

  async status(runId: string): Promise<ExternalRunStatus> {
    const json = await this.json('GET', `/checks/runs/${encodeURIComponent(runId)}`);
    return ExternalRunStatusSchema.parse(json);
  }

  async cancel(runId: string): Promise<void> {
    await this.json('POST', `/checks/cancel/${encodeURIComponent(runId)}`);
  }

  async healthz(): Promise<{ status: string; checks_registered: number }> {
    return (await this.json('GET', '/healthz')) as {
      status: string;
      checks_registered: number;
    };
  }

  async *stream(runId: string): AsyncGenerator<ExternalRunnerStreamEvent, void, void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/checks/runs/${encodeURIComponent(runId)}/stream`,
      {
        method: 'GET',
        headers: this.headers({ accept: 'text/event-stream' }),
      },
    );
    if (!res.ok || !res.body) {
      throw new ExternalAuditEvidenceRunnerError(res.status, await safeText(res));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = parseSseEvent(raw);
        if (event) yield event;
        idx = buffer.indexOf('\n\n');
      }
    }
  }

  private async json(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const init: RequestInit = {
        method,
        headers: this.headers({ 'content-type': 'application/json' }),
        signal: ctrl.signal,
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
      const text = await safeText(res);
      if (!res.ok) {
        const parsed = tryParseJson(text);
        throw new ExternalAuditEvidenceRunnerError(res.status, parsed ?? text);
      }
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timer);
    }
  }

  private headers(extra: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = { ...extra };
    if (this.authToken !== undefined) {
      out['authorization'] = `Bearer ${this.authToken}`;
    }
    return out;
  }
}

function parseSseEvent(raw: string): ExternalRunnerStreamEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const dataStr = dataLines.join('\n');
  const data = tryParseJson(dataStr) ?? dataStr;
  return { event, data };
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
