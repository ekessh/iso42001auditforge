// SPDX-License-Identifier: BUSL-1.1
/**
 * Adapter wrapping NVIDIA garak (Apache-2.0).
 *
 * Upstream: https://github.com/NVIDIA/garak
 * License:  Apache-2.0
 *
 * This adapter does NOT vendor any garak source — at runtime the worker
 * sandbox spawns the `garak` Python CLI with `--list_probes --json` to
 * enumerate available probes, and `garak --probes <id> --report_prefix ...`
 * to run a single probe. We translate garak's report JSON into AuditForge's
 * `ProbeRunResult` format and stamp every probe with the upstream license +
 * version metadata required by ISO/IEC 42001 evidence-attribution rules.
 *
 * Translation table (garak family -> AuditForge):
 *
 *   dan, jailbreak     -> A.6.2.7 (security of operation), OWASP LLM01
 *   leakreplay         -> A.7.4 (data quality), OWASP LLM02 (sensitive info)
 *   lmrc (toxicity)    -> A.6.2.6 (deployment governance)
 *   misleading         -> A.5.4 (impact assessment)
 *   promptinject       -> A.6.2.7, OWASP LLM01
 *
 * Adapters are deliberately thin: translation + invocation + normalisation,
 * nothing more. We stay close to garak's output structure so a reviewer can
 * diff our normalised result against the upstream report file.
 */
import { z } from 'zod';

import { defineProbe, type ProbeDefinition } from '../dsl.js';
import type { ProbeSandbox, SandboxPolicy } from '../sandbox.js';

import {
  ExternalAdapterError,
  defaultExternalBudget,
  eraseDefinition,
  makeExternalProbeId,
  pickMappingRule,
  toProbeRunResult,
  type CategoryMappingRule,
  type EnvironmentCheck,
  type ExternalProbeAdapter,
  type ExternalProbeDescriptor,
  type ExternalProbeResult,
  type ExternalProbeRunParams,
  type ProbeExecutionResult,
  type ProcessSpawner,
  type SpawnResult,
  type UpstreamProvenance,
} from './index.js';

/** Default upstream version pin. The worker overrides at construction. */
export const GARAK_DEFAULT_VERSION = '0.10.0';

/**
 * garak category -> AuditForge mapping table. The order matters: more
 * specific upstream prefixes must come first (we match longest prefix first
 * via `pickMappingRule`).
 */
export const GARAK_MAPPING_RULES: readonly CategoryMappingRule[] = [
  {
    upstreamCategory: 'dan',
    probeCategory: 'injection',
    controls: {
      clauses: [],
      annexA: ['A.6.2.7'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM01' }],
    },
  },
  {
    upstreamCategory: 'jailbreak',
    probeCategory: 'injection',
    controls: {
      clauses: [],
      annexA: ['A.6.2.7'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM01' }],
    },
  },
  {
    upstreamCategory: 'promptinject',
    probeCategory: 'injection',
    controls: {
      clauses: [],
      annexA: ['A.6.2.7'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM01' }],
    },
  },
  {
    upstreamCategory: 'probes/promptinject',
    probeCategory: 'injection',
    controls: {
      clauses: [],
      annexA: ['A.6.2.7'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM01' }],
    },
  },
  {
    upstreamCategory: 'leakreplay',
    probeCategory: 'leakage',
    controls: {
      clauses: [],
      annexA: ['A.7.4'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM02' }],
    },
  },
  {
    upstreamCategory: 'lmrc',
    probeCategory: 'toxicity',
    controls: { clauses: [], annexA: ['A.6.2.6'], external: [] },
  },
  {
    upstreamCategory: 'misleading',
    probeCategory: 'hallucination',
    controls: { clauses: [], annexA: ['A.5.4'], external: [] },
  },
];

const GARAK_FALLBACK_RULE: CategoryMappingRule = {
  upstreamCategory: '__default__',
  probeCategory: 'capability',
  controls: { clauses: [], annexA: [], external: [] },
};

/** Schema for `garak --list_probes --json` output. */
const ListProbesEntrySchema = z.object({
  name: z.string().min(1),
  module: z.string().min(1).optional(),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  uri: z.string().optional(),
});
const ListProbesSchema = z.object({
  probes: z.array(ListProbesEntrySchema),
});

/** Schema for the per-attempt entries garak emits in its JSONL report. */
const GarakReportAttemptSchema = z.object({
  entry_type: z.literal('attempt').optional(),
  probe: z.string().optional(),
  detector: z.string().optional(),
  /** garak emits `passed` / `triggered` / `score` per probe-detector pair. */
  passed: z.boolean().optional(),
  triggered: z.boolean().optional(),
  score: z.number().optional(),
  prompt: z.string().optional(),
  outputs: z.array(z.string()).default([]),
});

/** Top-level garak report schema (reduced). */
const GarakReportSchema = z.object({
  probe: z.string(),
  attempts: z.array(GarakReportAttemptSchema).default([]),
  /** Aggregate counts garak emits on the `eval` line. */
  summary: z
    .object({
      attempts: z.number().default(0),
      hits: z.number().default(0),
      score: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const ParamsSchema = z.object({
  upstreamId: z.string().min(1),
  upstreamArgs: z.record(z.unknown()).optional(),
  replayPayload: z.unknown().optional(),
});

export interface GarakAdapterDeps {
  readonly spawner: ProcessSpawner;
  /** Path to the garak executable (e.g. `garak`, `python -m garak`). */
  readonly executable?: string;
  /** Upstream version pin used in provenance metadata. */
  readonly version?: string;
}

export class GarakAdapter implements ExternalProbeAdapter {
  readonly name = 'garak' as const;
  readonly upstreamLicense = 'Apache-2.0' as const;
  readonly upstreamVersion: string;
  private readonly spawner: ProcessSpawner;
  private readonly executable: string;

  constructor(deps: GarakAdapterDeps) {
    this.spawner = deps.spawner;
    this.executable = deps.executable ?? 'garak';
    this.upstreamVersion = deps.version ?? GARAK_DEFAULT_VERSION;
  }

  /**
   * Enumerate upstream probes by invoking `garak --list_probes --json`.
   * The adapter never trusts garak's stdout structure beyond what the schema
   * validates; malformed output yields `ExternalAdapterError`.
   */
  async listProbes(): Promise<readonly ExternalProbeDescriptor[]> {
    const out = await this.spawner.spawn(
      this.executable,
      ['--list_probes', '--json'],
      { timeoutMs: 30_000 },
    );
    if (out.timedOut) {
      throw new ExternalAdapterError('LIST_TIMEOUT', this.name, 'garak --list_probes timed out');
    }
    if (out.exitCode !== 0) {
      throw new ExternalAdapterError(
        'LIST_FAILED',
        this.name,
        `garak --list_probes exited ${out.exitCode}`,
        { stderr: out.stderr },
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(out.stdout);
    } catch (e) {
      throw new ExternalAdapterError(
        'LIST_MALFORMED',
        this.name,
        `garak --list_probes returned invalid JSON: ${(e as Error).message}`,
      );
    }
    const result = ListProbesSchema.safeParse(parsed);
    if (!result.success) {
      throw new ExternalAdapterError(
        'LIST_SCHEMA',
        this.name,
        'garak --list_probes JSON did not match expected schema',
        { issues: result.error.issues },
      );
    }
    return result.data.probes.map((p) => {
      const upstreamId = p.name;
      const family = upstreamId.split('.')[0] ?? upstreamId;
      const provenance: UpstreamProvenance = {
        upstreamId,
        upstreamLicense: this.upstreamLicense,
        upstreamVersion: this.upstreamVersion,
        upstreamLibrary: this.name,
        upstreamHomepage: 'https://github.com/NVIDIA/garak',
      };
      return {
        upstreamId,
        displayName: upstreamId,
        description: p.description,
        upstreamCategory: family,
        upstreamTags: p.tags,
        provenance,
      } satisfies ExternalProbeDescriptor;
    });
  }

  /**
   * Translate an upstream descriptor into an AuditForge `ProbeDefinition`. The
   * generated id uses a hashed-by-position scheme (`P-GRK-NNN`) deterministic
   * for a given listProbes ordering.
   */
  translateToAuditForge(
    descriptor: ExternalProbeDescriptor,
    /** Stable index assigned by the registry; defaults to a hash for tests. */
    index?: number,
  ): ProbeDefinition<ExternalProbeRunParams, unknown> {
    const rule = pickMappingRule(
      GARAK_MAPPING_RULES,
      descriptor.upstreamCategory,
      GARAK_FALLBACK_RULE,
    );
    const i = index ?? this.stableIndex(descriptor.upstreamId);
    const id = makeExternalProbeId(this.name, i);
    const def = defineProbe<ExternalProbeRunParams, unknown>({
      meta: {
        id,
        name: `garak — ${descriptor.displayName}`,
        description: descriptor.description || `garak probe ${descriptor.upstreamId}`,
        version: '0.1.0',
        category: rule.probeCategory,
        targetKinds: ['llm-generative', 'llm-rag', 'agentic'],
        controls: rule.controls,
        executionModes: ['offline', 'live', 'replay'],
        budget: defaultExternalBudget(),
        references: [
          { title: `garak (NVIDIA, Apache-2.0): ${descriptor.upstreamId}`, url: 'https://github.com/NVIDIA/garak' },
        ],
        groundTruthFixturePath: `external/garak/${descriptor.upstreamId}.json`,
        deterministic: false,
        requiresInferenceClient: false,
        tags: ['external', 'garak', ...descriptor.upstreamTags],
      },
      parametersSchema: ParamsSchema,
      async run(_ctx, _params) {
        // Adapters proxy execution through `GarakAdapter.run()`; the
        // definition's run is a placeholder used only by replay mode where
        // the runner already has the parsed result. We return `inconclusive`
        // so it is obvious this path is the synthesised stub.
        return {
          verdict: 'inconclusive',
          score: 0,
          derivedMetrics: { reason: 'definition stub; use GarakAdapter.run' },
        };
      },
    });
    return def;
  }

  /**
   * Run a garak probe inside the supplied sandbox. Cost / timeout enforcement
   * is delegated to the sandbox via `policy.wallClockMaxMs`. Adapters never
   * implement their own timeout — `SpawnOptions.timeoutMs` mirrors the policy.
   */
  async run(
    probeId: string,
    params: ExternalProbeRunParams,
    sandbox: ProbeSandbox,
    policy: SandboxPolicy,
  ): Promise<ProbeExecutionResult> {
    const validated = ParamsSchema.parse(params);
    const provenance: UpstreamProvenance = {
      upstreamId: validated.upstreamId,
      upstreamLicense: this.upstreamLicense,
      upstreamVersion: this.upstreamVersion,
      upstreamLibrary: this.name,
      upstreamHomepage: 'https://github.com/NVIDIA/garak',
    };

    // Replay mode: caller supplies pre-collected garak JSON, no spawn.
    if (validated.replayPayload !== undefined) {
      const parsed = this.parseReport(validated.replayPayload, validated.upstreamId);
      return this.toExecutionResult(parsed, provenance, sandbox);
    }

    const out: SpawnResult = await this.spawner.spawn(
      this.executable,
      ['--probes', validated.upstreamId, '--report_prefix', 'auditforge', '--narrow_output'],
      { timeoutMs: policy.wallClockMaxMs },
    );

    if (out.timedOut) {
      throw new ExternalAdapterError(
        'RUN_TIMEOUT',
        this.name,
        `garak run for ${validated.upstreamId} exceeded wall clock`,
        { wallClockMaxMs: policy.wallClockMaxMs, probeId },
      );
    }
    if (out.exitCode !== 0) {
      throw new ExternalAdapterError(
        'RUN_FAILED',
        this.name,
        `garak run for ${validated.upstreamId} exited ${out.exitCode}`,
        { stderr: out.stderr, probeId },
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(out.stdout);
    } catch (e) {
      throw new ExternalAdapterError(
        'RUN_MALFORMED',
        this.name,
        `garak run output was not valid JSON: ${(e as Error).message}`,
        { probeId },
      );
    }
    const parsed = this.parseReport(json, validated.upstreamId);
    return this.toExecutionResult(parsed, provenance, sandbox);
  }

  /**
   * Verify that the upstream tool is available. We invoke
   * `garak --version`; absence yields a list of remediation reasons.
   */
  async verifyEnvironment(): Promise<EnvironmentCheck> {
    const reasons: string[] = [];
    let out: SpawnResult;
    try {
      out = await this.spawner.spawn(this.executable, ['--version'], {
        timeoutMs: 10_000,
      });
    } catch (e) {
      return {
        ok: false,
        reasons: [`failed to spawn ${this.executable}: ${(e as Error).message}`],
      };
    }
    if (out.timedOut) reasons.push('garak --version timed out');
    if (out.exitCode !== 0) {
      reasons.push(`garak --version exited ${out.exitCode}: ${out.stderr.trim()}`);
    } else if (!/garak\s+/i.test(out.stdout)) {
      reasons.push(
        'garak --version stdout did not contain "garak" — wrong binary on PATH',
      );
    }
    return { ok: reasons.length === 0, reasons };
  }

  // -------------------------------------------------------------------------
  // Helpers below stay close to upstream output structure.
  // -------------------------------------------------------------------------

  /** Stable, deterministic id for a probe based on its upstream name. */
  private stableIndex(upstreamId: string): number {
    let h = 0;
    for (let i = 0; i < upstreamId.length; i++) {
      h = (h * 31 + upstreamId.charCodeAt(i)) >>> 0;
    }
    return h % 1000;
  }

  /** Parse and normalise a garak report JSON payload. */
  private parseReport(json: unknown, upstreamId: string): ExternalProbeResult {
    const report = GarakReportSchema.safeParse(json);
    if (!report.success) {
      throw new ExternalAdapterError(
        'REPORT_SCHEMA',
        this.name,
        `garak report for ${upstreamId} did not match expected schema`,
        { issues: report.error.issues },
      );
    }
    const r = report.data;
    const attempts = r.summary?.attempts ?? r.attempts.length;
    const hits =
      r.summary?.hits ??
      r.attempts.filter((a) => a.triggered === true || a.passed === false).length;
    const passed = attempts === 0 ? 0 : Math.max(0, attempts - hits);
    const rate = attempts === 0 ? 0 : hits / attempts;
    const score = r.summary?.score ?? Math.max(0, Math.min(1, 1 - rate));

    let verdictTag: ExternalProbeResult['verdictTag'];
    if (attempts === 0) {
      verdictTag = 'inconclusive';
    } else if (hits === 0) {
      verdictTag = 'attack-blocked';
    } else {
      verdictTag = 'attack-succeeded';
    }

    return {
      verdictTag,
      score,
      derivedMetrics: {
        attempts,
        hits,
        passed,
        hitRate: rate,
        upstreamProbe: r.probe,
      },
      upstreamRaw: json,
    };
  }

  /**
   * Final shaping for the runner. We invoke the sandbox-supplied
   * `runFn` only as a way to thread the `ProbeRunResult` shape through; the
   * actual subprocess work has already happened above. This indirection lets
   * callers swap a real sandbox for a stub without changing the public API.
   */
  private async toExecutionResult(
    parsed: ExternalProbeResult,
    provenance: UpstreamProvenance,
    _sandbox: ProbeSandbox,
  ): Promise<ProbeExecutionResult> {
    const run = toProbeRunResult(parsed, provenance);
    return {
      verdict: run.verdict,
      score: run.score,
      derivedMetrics: run.derivedMetrics,
      rawResponse: parsed.upstreamRaw,
      provenance,
      evidence: run.evidence ?? [],
    };
  }
}

/** Convenience for callers that want a registry-shaped definition. */
export function translateGarakDescriptor(
  adapter: GarakAdapter,
  descriptor: ExternalProbeDescriptor,
  index?: number,
): ProbeDefinition<ExternalProbeRunParams, unknown> {
  return adapter.translateToAuditForge(descriptor, index);
}

export const __internal = { eraseDefinition };
