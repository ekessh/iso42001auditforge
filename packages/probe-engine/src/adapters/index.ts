// SPDX-License-Identifier: BUSL-1.1
/**
 * External probe-library adapters.
 *
 * Per v3 design Section 15.16 #4, AuditForge ISO 42001 wraps mature upstream
 * red-team / harm-evaluation libraries instead of re-implementing every probe:
 *
 *   - garak     — NVIDIA, Apache-2.0
 *   - PyRIT     — Microsoft, MIT
 *   - HarmBench — CAIS (Center for AI Safety), MIT
 *
 * Each adapter is intentionally thin: it (a) lists upstream probes,
 * (b) translates them to AuditForge ProbeDefinition metadata (clauses, Annex A
 * controls, OWASP LLM Top 10 mappings), (c) invokes the upstream tool inside
 * the existing probe sandbox, and (d) normalises upstream output into a
 * `ProbeRunResult`. We deliberately stay close to upstream output structure so
 * the diff between AuditForge and upstream remains small and reviewable.
 *
 * Adapters NEVER spawn Python directly via `child_process` — they call out
 * through an injected `ProcessSpawner` so unit tests can mock the subprocess
 * boundary without ever executing Python.
 */
import type {
  AnyProbeDefinition,
  ProbeDefinition,
  ProbeRunResult,
} from '../dsl.js';
import type { ProbeSandbox, SandboxPolicy } from '../sandbox.js';
import type {
  ProbeCategory,
  ControlMapping,
  ProbeBudget,
  ProbeVerdict,
} from '../types.js';

/**
 * Upstream library identifier — the only three values the adapter system
 * accepts at this revision.
 */
export type ExternalLibraryName = 'garak' | 'pyrit' | 'harmbench';

/** SPDX identifier for the upstream library license. */
export type UpstreamLicense = 'Apache-2.0' | 'MIT' | 'BSD-3-Clause';

/**
 * License + provenance metadata stamped onto every translated probe. The
 * audit ledger surfaces this so lead auditors can demonstrate proper upstream
 * attribution.
 */
export interface UpstreamProvenance {
  /** Upstream probe id verbatim (e.g. `dan.Dan_11_0`, `promptinject.HijackHateHumans`). */
  readonly upstreamId: string;
  /** SPDX identifier of the upstream library. */
  readonly upstreamLicense: UpstreamLicense;
  /** Upstream library version pin (e.g. `garak==0.10.0`). */
  readonly upstreamVersion: string;
  /** Human-readable upstream library name. */
  readonly upstreamLibrary: ExternalLibraryName;
  /** Upstream homepage / repo URL for documentation. */
  readonly upstreamHomepage?: string;
}

/**
 * Tags emitted by external probes that the verdict mapper consumes. Adapters
 * normalise upstream verdicts into one of these before letting the runner
 * project to `ProbeVerdict`.
 */
export type UpstreamVerdictTag =
  | 'attack-succeeded'
  | 'attack-blocked'
  | 'harmful-output'
  | 'safe-output'
  | 'inconclusive'
  | 'errored';

/** Descriptor of an external probe before it has been translated. */
export interface ExternalProbeDescriptor {
  /** Upstream id (e.g. `dan.Dan_11_0`). */
  readonly upstreamId: string;
  /** Upstream short name (suitable for UI). */
  readonly displayName: string;
  /** Upstream description. */
  readonly description: string;
  /** Upstream category / family (raw, used by the mapping table). */
  readonly upstreamCategory: string;
  /** Upstream tags (harm category, owasp ref, etc). */
  readonly upstreamTags: readonly string[];
  /** Provenance + license metadata. */
  readonly provenance: UpstreamProvenance;
}

/**
 * Single adapter mapping rule — translates an upstream category to AuditForge
 * clauses, Annex A controls, and external framework refs (OWASP LLM Top 10).
 */
export interface CategoryMappingRule {
  readonly upstreamCategory: string;
  readonly probeCategory: ProbeCategory;
  readonly controls: ControlMapping;
}

/** Normalised, parsed result the adapter emits before the runner wraps it. */
export interface ExternalProbeResult {
  readonly verdictTag: UpstreamVerdictTag;
  readonly score: number;
  readonly derivedMetrics: Readonly<Record<string, number | string | boolean>>;
  /** Upstream JSON kept as-is (so audit reviewers can diff against upstream). */
  readonly upstreamRaw: unknown;
  /**
   * For attack/defense co-evaluation (HarmBench): when set, surfaces both
   * the attacker-side and defender-side verdicts.
   */
  readonly coEvaluation?: {
    readonly attack: UpstreamVerdictTag;
    readonly defense: UpstreamVerdictTag;
  };
}

/** Final result handed back from `run()`. Shaped to feed `ProbeRunResult`. */
export interface ProbeExecutionResult {
  readonly verdict: ProbeVerdict;
  readonly score: number;
  readonly derivedMetrics: Readonly<Record<string, number | string | boolean>>;
  readonly rawResponse: unknown;
  readonly provenance: UpstreamProvenance;
  readonly evidence: ReadonlyArray<{
    readonly kind:
      | 'raw-response'
      | 'derived-metric'
      | 'sample-set'
      | 'screenshot'
      | 'trace'
      | 'fixture'
      | 'report';
    readonly contentType: string;
    readonly inline?: unknown;
  }>;
}

/**
 * Result of probing the host environment for the upstream tool.
 * `verifyEnvironment` returns this so the worker can surface a clear "you need
 * to install garak" message rather than burying the error in stderr.
 */
export interface EnvironmentCheck {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/**
 * Subprocess output as observed by the adapter. Stdout / stderr / exit code
 * are the only signals the adapter trusts — all interpretation is done in
 * pure TypeScript so unit tests can drive every code path.
 */
export interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
}

export interface SpawnOptions {
  readonly timeoutMs: number;
  /** Optional environment overrides. Adapters never read process.env directly. */
  readonly env?: Readonly<Record<string, string>>;
  /** Optional cwd. Adapters never default this; the worker chooses. */
  readonly cwd?: string;
  /** Bytes of stdin to feed (used for pyrit prompt batches). */
  readonly stdin?: string;
}

/**
 * Subprocess spawner contract. The worker passes a real implementation that
 * uses `node:child_process.spawn`; tests pass a mock that returns canned
 * `SpawnResult`s. The adapter is therefore unit-testable without ever
 * touching Python.
 */
export interface ProcessSpawner {
  spawn(
    command: string,
    args: readonly string[],
    opts: SpawnOptions,
  ): Promise<SpawnResult>;
}

/**
 * Adapter-side parameters surfaced to the runner.
 *
 * Note: optional fields are typed as `T | undefined` rather than `?: T` so
 * the type structurally matches what `zod.optional()` produces. This is
 * required for `parametersSchema: z.ZodType<ExternalProbeRunParams>` to
 * type-check under `exactOptionalPropertyTypes: true`.
 */
export interface ExternalProbeRunParams {
  /** Upstream probe id we want to execute (must be one returned by listProbes). */
  readonly upstreamId: string;
  /** Optional upstream-specific args (e.g. number of attempts). */
  readonly upstreamArgs?: Record<string, unknown> | undefined;
  /** Pre-collected upstream JSON (offline / replay mode). */
  readonly replayPayload?: unknown;
}

/**
 * The adapter contract. All three external libraries implement this so the
 * runner can route through a single code path.
 */
export interface ExternalProbeAdapter {
  readonly name: ExternalLibraryName;
  readonly upstreamLicense: UpstreamLicense;
  readonly upstreamVersion: string;

  listProbes(): Promise<readonly ExternalProbeDescriptor[]>;
  translateToAuditForge(
    descriptor: ExternalProbeDescriptor,
  ): ProbeDefinition<ExternalProbeRunParams, unknown>;
  run(
    probeId: string,
    params: ExternalProbeRunParams,
    sandbox: ProbeSandbox,
    policy: SandboxPolicy,
  ): Promise<ProbeExecutionResult>;
  verifyEnvironment(): Promise<EnvironmentCheck>;
}

/** Errors the adapters throw share a common shape so the runner can attribute them. */
export class ExternalAdapterError extends Error {
  public readonly code: string;
  public readonly library: ExternalLibraryName;
  public readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: string,
    library: ExternalLibraryName,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ExternalAdapterError';
    this.code = code;
    this.library = library;
    this.details = Object.freeze({ ...details });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers used by all three adapters.
// ---------------------------------------------------------------------------

/**
 * Project an upstream verdict tag onto an AuditForge `ProbeVerdict`.
 *
 *   attack-succeeded  -> fail   (the auditee model fell to the attack)
 *   harmful-output    -> fail
 *   attack-blocked    -> pass
 *   safe-output       -> pass
 *   inconclusive      -> inconclusive
 *   errored           -> error
 */
export function projectVerdict(tag: UpstreamVerdictTag): ProbeVerdict {
  switch (tag) {
    case 'attack-succeeded':
    case 'harmful-output':
      return 'fail';
    case 'attack-blocked':
    case 'safe-output':
      return 'pass';
    case 'inconclusive':
      return 'inconclusive';
    case 'errored':
      return 'error';
  }
}

/**
 * Build the standard external-probe budget. External probes default to
 * higher wall clock and memory because Python interpreters are slow to spin
 * up; the runner's sandbox still enforces these caps.
 */
export function defaultExternalBudget(): ProbeBudget {
  return {
    estimatedCallsMin: 0,
    estimatedCallsMax: 100,
    costEstimateUsd: 1,
    wallClockMaxMs: 300_000,
    memoryMaxMb: 1024,
    cpuMaxMs: 240_000,
  };
}

/**
 * Lookup helper: given a list of mapping rules, return the rule whose
 * `upstreamCategory` is a prefix of the supplied descriptor category. Falls
 * back to the supplied default rule. Matching is case-insensitive and uses
 * dot-segments so e.g. `dan.Dan_11_0` matches the `dan` rule.
 */
export function pickMappingRule(
  rules: readonly CategoryMappingRule[],
  descriptorCategory: string,
  fallback: CategoryMappingRule,
): CategoryMappingRule {
  const needle = descriptorCategory.toLowerCase();
  for (const rule of rules) {
    const hay = rule.upstreamCategory.toLowerCase();
    if (needle === hay) return rule;
    if (needle.startsWith(`${hay}.`)) return rule;
    if (needle.startsWith(`${hay}/`)) return rule;
  }
  return fallback;
}

/**
 * Make an adapter-internal probe id. AuditForge ids look like P-INJ-01;
 * external probes use a deterministic shorthand of the upstream id so the
 * registry can look them up. Collisions are intentionally avoided per
 * library prefix.
 */
export function makeExternalProbeId(
  library: ExternalLibraryName,
  index: number,
): string {
  const prefix =
    library === 'garak' ? 'GRK' : library === 'pyrit' ? 'PYR' : 'HRM';
  const padded = String(index).padStart(3, '0');
  return `P-${prefix}-${padded}`;
}

/**
 * Convert an `ExternalProbeResult` to a `ProbeRunResult` so the runner can
 * persist it without further translation. The adapter-supplied provenance is
 * folded into derivedMetrics so the audit ledger captures upstream
 * attribution alongside numeric metrics.
 */
export function toProbeRunResult(
  result: ExternalProbeResult,
  provenance: UpstreamProvenance,
): ProbeRunResult<unknown> {
  const verdict = projectVerdict(result.verdictTag);
  if (verdict === 'error') {
    return {
      verdict: 'inconclusive',
      score: 0,
      derivedMetrics: {
        ...result.derivedMetrics,
        upstreamLibrary: provenance.upstreamLibrary,
        upstreamLicense: provenance.upstreamLicense,
        upstreamVersion: provenance.upstreamVersion,
        upstreamId: provenance.upstreamId,
        verdictTag: result.verdictTag,
      },
    };
  }
  const evidence: Array<{
    kind:
      | 'raw-response'
      | 'derived-metric'
      | 'sample-set'
      | 'screenshot'
      | 'trace'
      | 'fixture'
      | 'report';
    contentType: string;
    inline?: unknown;
  }> = [
    {
      kind: 'raw-response',
      contentType: 'application/json',
      inline: result.upstreamRaw,
    },
  ];
  if (result.coEvaluation) {
    evidence.push({
      kind: 'derived-metric',
      contentType: 'application/json',
      inline: result.coEvaluation,
    });
  }
  return {
    verdict,
    score: result.score,
    derivedMetrics: {
      ...result.derivedMetrics,
      upstreamLibrary: provenance.upstreamLibrary,
      upstreamLicense: provenance.upstreamLicense,
      upstreamVersion: provenance.upstreamVersion,
      upstreamId: provenance.upstreamId,
      verdictTag: result.verdictTag,
    },
    evidence,
  };
}

/** Type-erase a translated definition for the registry. */
export function eraseDefinition(
  def: ProbeDefinition<ExternalProbeRunParams, unknown>,
): AnyProbeDefinition {
  return def as unknown as AnyProbeDefinition;
}

// Re-export concrete adapters from sibling files. We use named exports only
// to avoid accidental default-export drift between the three adapters.
export { GarakAdapter } from './garak.js';
export { PyritAdapter } from './pyrit.js';
export { HarmbenchAdapter } from './harmbench.js';
