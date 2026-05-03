// SPDX-License-Identifier: BUSL-1.1
/**
 * Adapter wrapping Microsoft PyRIT (MIT).
 *
 * Upstream: https://github.com/Azure/PyRIT
 * License:  MIT
 *
 * PyRIT is a structured red-team orchestration framework: it composes
 * `Orchestrator`s (red-team, end-to-end attack chains) with `Scorer`s
 * (true/false, content classifier, harm category). Our adapter exposes
 * orchestrator+scorer pairs as AuditForge probes.
 *
 * Verdict mapping:
 *
 *   true_false_scorer            -> attack-succeeded / attack-blocked
 *   content_classifier_scorer    -> harmful-output / safe-output
 *   harm_category_scorer         -> harmful-output (when category != benign)
 *
 * Clause mapping:
 *
 *   harmful output               -> A.6.2.6 (deployment governance)
 *   agentic attack chains        -> A.6.2.7 (security) + A.9 (use of AI)
 *   sensitive information leak   -> A.7.4 (data quality)
 */
import { z } from 'zod';

import { defineProbe, type ProbeDefinition } from '../dsl.js';
import type { ProbeSandbox, SandboxPolicy } from '../sandbox.js';

import {
  ExternalAdapterError,
  defaultExternalBudget,
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
  type UpstreamVerdictTag,
} from './index.js';

export const PYRIT_DEFAULT_VERSION = '0.5.0';

/**
 * PyRIT exposes orchestrators by canonical name. We classify them into the
 * three families AuditForge cares about. Order is longest-prefix-first.
 */
export const PYRIT_MAPPING_RULES: readonly CategoryMappingRule[] = [
  {
    upstreamCategory: 'sensitive_information',
    probeCategory: 'leakage',
    controls: {
      clauses: [],
      annexA: ['A.7.4'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM02' }],
    },
  },
  {
    upstreamCategory: 'sensitive-information',
    probeCategory: 'leakage',
    controls: {
      clauses: [],
      annexA: ['A.7.4'],
      external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM02' }],
    },
  },
  {
    upstreamCategory: 'agentic_attack',
    probeCategory: 'injection',
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.9'], external: [] },
  },
  {
    upstreamCategory: 'agentic-attack',
    probeCategory: 'injection',
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.9'], external: [] },
  },
  {
    upstreamCategory: 'end_to_end_attack',
    probeCategory: 'injection',
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.9'], external: [] },
  },
  {
    upstreamCategory: 'red_team',
    probeCategory: 'injection',
    controls: { clauses: [], annexA: ['A.6.2.7'], external: [] },
  },
  {
    upstreamCategory: 'harmful_output',
    probeCategory: 'toxicity',
    controls: { clauses: [], annexA: ['A.6.2.6'], external: [] },
  },
  {
    upstreamCategory: 'harm',
    probeCategory: 'toxicity',
    controls: { clauses: [], annexA: ['A.6.2.6'], external: [] },
  },
];

const PYRIT_FALLBACK_RULE: CategoryMappingRule = {
  upstreamCategory: '__default__',
  probeCategory: 'capability',
  controls: { clauses: [], annexA: [], external: [] },
};

/** Schema for `pyrit list-orchestrators --json` output. */
const OrchestratorEntrySchema = z.object({
  id: z.string().min(1),
  display_name: z.string().default(''),
  description: z.string().default(''),
  family: z.string().default(''),
  scorer: z
    .enum([
      'true_false_scorer',
      'content_classifier_scorer',
      'harm_category_scorer',
    ])
    .default('true_false_scorer'),
  tags: z.array(z.string()).default([]),
});
const ListOrchestratorsSchema = z.object({
  orchestrators: z.array(OrchestratorEntrySchema),
});

/** Schema for a PyRIT execution result JSON line. */
const PyritScoreSchema = z.object({
  scorer: z.enum([
    'true_false_scorer',
    'content_classifier_scorer',
    'harm_category_scorer',
  ]),
  /** boolean for true/false; classifier label string; harm category string */
  value: z.union([z.boolean(), z.string()]),
  /** Numeric confidence in [0,1] when available. */
  confidence: z.number().min(0).max(1).optional(),
  /** Harm category (e.g. `violence`, `hate`, `benign`). */
  harm_category: z.string().optional(),
});

const PyritResultSchema = z.object({
  orchestrator: z.string(),
  attempts: z.number().int().nonnegative().default(0),
  successes: z.number().int().nonnegative().default(0),
  scores: z.array(PyritScoreSchema).default([]),
  /** Top-level normalised score; PyRIT emits this on the closing line. */
  score: z.number().min(0).max(1).optional(),
  /** Free-form trace for evidence storage. */
  trace: z.unknown().optional(),
});

const ParamsSchema = z.object({
  upstreamId: z.string().min(1),
  upstreamArgs: z.record(z.unknown()).optional(),
  replayPayload: z.unknown().optional(),
});

export interface PyritAdapterDeps {
  readonly spawner: ProcessSpawner;
  /** Path to PyRIT runner (e.g. `pyrit`, `python -m pyrit.cli`). */
  readonly executable?: string;
  readonly version?: string;
}

export class PyritAdapter implements ExternalProbeAdapter {
  readonly name = 'pyrit' as const;
  readonly upstreamLicense = 'MIT' as const;
  readonly upstreamVersion: string;
  private readonly spawner: ProcessSpawner;
  private readonly executable: string;

  constructor(deps: PyritAdapterDeps) {
    this.spawner = deps.spawner;
    this.executable = deps.executable ?? 'pyrit';
    this.upstreamVersion = deps.version ?? PYRIT_DEFAULT_VERSION;
  }

  async listProbes(): Promise<readonly ExternalProbeDescriptor[]> {
    const out = await this.spawner.spawn(
      this.executable,
      ['list-orchestrators', '--json'],
      { timeoutMs: 30_000 },
    );
    if (out.timedOut) {
      throw new ExternalAdapterError('LIST_TIMEOUT', this.name, 'pyrit list-orchestrators timed out');
    }
    if (out.exitCode !== 0) {
      throw new ExternalAdapterError(
        'LIST_FAILED',
        this.name,
        `pyrit list-orchestrators exited ${out.exitCode}`,
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
        `pyrit list-orchestrators returned invalid JSON: ${(e as Error).message}`,
      );
    }
    const result = ListOrchestratorsSchema.safeParse(parsed);
    if (!result.success) {
      throw new ExternalAdapterError(
        'LIST_SCHEMA',
        this.name,
        'pyrit list-orchestrators JSON did not match expected schema',
        { issues: result.error.issues },
      );
    }
    return result.data.orchestrators.map((o) => {
      const family = o.family || o.id.split('.')[0] || o.id;
      const provenance: UpstreamProvenance = {
        upstreamId: o.id,
        upstreamLicense: this.upstreamLicense,
        upstreamVersion: this.upstreamVersion,
        upstreamLibrary: this.name,
        upstreamHomepage: 'https://github.com/Azure/PyRIT',
      };
      return {
        upstreamId: o.id,
        displayName: o.display_name || o.id,
        description: o.description,
        upstreamCategory: family,
        upstreamTags: [...o.tags, `scorer:${o.scorer}`],
        provenance,
      } satisfies ExternalProbeDescriptor;
    });
  }

  translateToAuditForge(
    descriptor: ExternalProbeDescriptor,
    index?: number,
  ): ProbeDefinition<ExternalProbeRunParams, unknown> {
    const rule = pickMappingRule(
      PYRIT_MAPPING_RULES,
      descriptor.upstreamCategory,
      PYRIT_FALLBACK_RULE,
    );
    const i = index ?? this.stableIndex(descriptor.upstreamId);
    const id = makeExternalProbeId(this.name, i);
    const def = defineProbe<ExternalProbeRunParams, unknown>({
      meta: {
        id,
        name: `PyRIT — ${descriptor.displayName}`,
        description: descriptor.description || `PyRIT orchestrator ${descriptor.upstreamId}`,
        version: '0.1.0',
        category: rule.probeCategory,
        targetKinds: ['llm-generative', 'llm-rag', 'agentic'],
        controls: rule.controls,
        executionModes: ['offline', 'live', 'replay'],
        budget: defaultExternalBudget(),
        references: [
          { title: `PyRIT (Microsoft, MIT): ${descriptor.upstreamId}`, url: 'https://github.com/Azure/PyRIT' },
        ],
        groundTruthFixturePath: `external/pyrit/${descriptor.upstreamId}.json`,
        deterministic: false,
        requiresInferenceClient: false,
        tags: ['external', 'pyrit', ...descriptor.upstreamTags],
      },
      parametersSchema: ParamsSchema,
      async run(_ctx, _params) {
        return {
          verdict: 'inconclusive',
          score: 0,
          derivedMetrics: { reason: 'definition stub; use PyritAdapter.run' },
        };
      },
    });
    return def;
  }

  async run(
    probeId: string,
    params: ExternalProbeRunParams,
    _sandbox: ProbeSandbox,
    policy: SandboxPolicy,
  ): Promise<ProbeExecutionResult> {
    const validated = ParamsSchema.parse(params);
    const provenance: UpstreamProvenance = {
      upstreamId: validated.upstreamId,
      upstreamLicense: this.upstreamLicense,
      upstreamVersion: this.upstreamVersion,
      upstreamLibrary: this.name,
      upstreamHomepage: 'https://github.com/Azure/PyRIT',
    };

    if (validated.replayPayload !== undefined) {
      const parsed = this.parseResult(validated.replayPayload, validated.upstreamId);
      return this.toExecutionResult(parsed, provenance);
    }

    // PyRIT accepts orchestrator args via stdin JSON when `--stdin` flag is
    // set. We always pass the args this way so the command line never
    // contains untrusted content.
    const stdin = JSON.stringify({
      orchestrator: validated.upstreamId,
      args: validated.upstreamArgs ?? {},
    });

    const out: SpawnResult = await this.spawner.spawn(
      this.executable,
      ['run', '--stdin', '--json'],
      { timeoutMs: policy.wallClockMaxMs, stdin },
    );

    if (out.timedOut) {
      throw new ExternalAdapterError(
        'RUN_TIMEOUT',
        this.name,
        `pyrit run for ${validated.upstreamId} exceeded wall clock`,
        { wallClockMaxMs: policy.wallClockMaxMs, probeId },
      );
    }
    if (out.exitCode !== 0) {
      throw new ExternalAdapterError(
        'RUN_FAILED',
        this.name,
        `pyrit run for ${validated.upstreamId} exited ${out.exitCode}`,
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
        `pyrit output was not valid JSON: ${(e as Error).message}`,
        { probeId },
      );
    }
    const parsed = this.parseResult(json, validated.upstreamId);
    return this.toExecutionResult(parsed, provenance);
  }

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
    if (out.timedOut) reasons.push('pyrit --version timed out');
    if (out.exitCode !== 0) {
      reasons.push(`pyrit --version exited ${out.exitCode}: ${out.stderr.trim()}`);
    } else if (!/pyrit/i.test(out.stdout)) {
      reasons.push('pyrit --version stdout did not contain "pyrit" — wrong binary on PATH');
    }
    return { ok: reasons.length === 0, reasons };
  }

  // -------------------------------------------------------------------------

  private stableIndex(upstreamId: string): number {
    let h = 0;
    for (let i = 0; i < upstreamId.length; i++) {
      h = (h * 31 + upstreamId.charCodeAt(i)) >>> 0;
    }
    return h % 1000;
  }

  /**
   * Project a single PyRIT score onto an `UpstreamVerdictTag`. Each scorer
   * type uses a different rule; the dominant tag of the run is the most
   * severe across attempts.
   */
  static scoreToVerdictTag(
    score: z.infer<typeof PyritScoreSchema>,
  ): UpstreamVerdictTag {
    if (score.scorer === 'true_false_scorer') {
      // PyRIT convention: `true` means the attack succeeded.
      return score.value === true ? 'attack-succeeded' : 'attack-blocked';
    }
    if (score.scorer === 'content_classifier_scorer') {
      const label = String(score.value).toLowerCase();
      if (label === 'safe' || label === 'benign') return 'safe-output';
      return 'harmful-output';
    }
    // harm_category_scorer
    const cat = (score.harm_category ?? String(score.value) ?? '').toLowerCase();
    if (cat === 'benign' || cat === 'none' || cat === 'safe') return 'safe-output';
    return 'harmful-output';
  }

  /** Reduce a list of verdict tags to a single dominant tag. */
  static dominantVerdictTag(
    tags: readonly UpstreamVerdictTag[],
  ): UpstreamVerdictTag {
    if (tags.length === 0) return 'inconclusive';
    const order: readonly UpstreamVerdictTag[] = [
      'errored',
      'harmful-output',
      'attack-succeeded',
      'inconclusive',
      'attack-blocked',
      'safe-output',
    ];
    for (const t of order) if (tags.includes(t)) return t;
    return 'inconclusive';
  }

  private parseResult(json: unknown, upstreamId: string): ExternalProbeResult {
    const parsed = PyritResultSchema.safeParse(json);
    if (!parsed.success) {
      throw new ExternalAdapterError(
        'REPORT_SCHEMA',
        this.name,
        `pyrit result for ${upstreamId} did not match expected schema`,
        { issues: parsed.error.issues },
      );
    }
    const r = parsed.data;
    const tags = r.scores.map((s) => PyritAdapter.scoreToVerdictTag(s));
    let verdictTag: UpstreamVerdictTag;
    if (r.attempts === 0) {
      verdictTag = 'inconclusive';
    } else if (tags.length === 0) {
      verdictTag =
        r.successes > 0 ? 'attack-succeeded' : 'attack-blocked';
    } else {
      verdictTag = PyritAdapter.dominantVerdictTag(tags);
    }

    const score =
      r.score ??
      (r.attempts === 0
        ? 0
        : Math.max(0, Math.min(1, 1 - r.successes / r.attempts)));

    return {
      verdictTag,
      score,
      derivedMetrics: {
        attempts: r.attempts,
        successes: r.successes,
        successRate: r.attempts === 0 ? 0 : r.successes / r.attempts,
        upstreamOrchestrator: r.orchestrator,
        scorerCount: r.scores.length,
      },
      upstreamRaw: json,
    };
  }

  private async toExecutionResult(
    parsed: ExternalProbeResult,
    provenance: UpstreamProvenance,
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
