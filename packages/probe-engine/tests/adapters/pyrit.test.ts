// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';

import { ProcessSandbox, type SandboxPolicy } from '../../src/sandbox.js';
import {
  ExternalAdapterError,
  type ProcessSpawner,
  type SpawnOptions,
  type SpawnResult,
} from '../../src/adapters/index.js';
import { PyritAdapter, PYRIT_MAPPING_RULES } from '../../src/adapters/pyrit.js';

class MockSpawner implements ProcessSpawner {
  public calls: { command: string; args: readonly string[]; opts: SpawnOptions }[] = [];
  public queue: SpawnResult[] = [];
  public throwOnNext: Error | null = null;

  enqueue(r: SpawnResult): void {
    this.queue.push(r);
  }
  async spawn(
    command: string,
    args: readonly string[],
    opts: SpawnOptions,
  ): Promise<SpawnResult> {
    this.calls.push({ command, args, opts });
    if (this.throwOnNext) {
      const e = this.throwOnNext;
      this.throwOnNext = null;
      throw e;
    }
    const next = this.queue.shift();
    if (!next) throw new Error('no spawn result enqueued');
    return next;
  }
}

const ok = (stdout: string, stderr = ''): SpawnResult => ({
  stdout,
  stderr,
  exitCode: 0,
  timedOut: false,
});

const failed = (stderr: string, code = 1): SpawnResult => ({
  stdout: '',
  stderr,
  exitCode: code,
  timedOut: false,
});

const policy: SandboxPolicy = {
  egressAllowlist: [],
  wallClockMaxMs: 90_000,
  cpuMaxMs: 60_000,
  memoryMaxMb: 1024,
  bandwidthMaxBytes: 1024,
  readOnlyMounts: [],
  tmpDirEnabled: true,
  tmpDirMaxBytes: 1024,
  inferenceClientEnabled: false,
};

const SAMPLE_LIST = JSON.stringify({
  orchestrators: [
    {
      id: 'red_team.aligned_attack',
      display_name: 'Aligned Red Team',
      description: 'Aligned red-team attack',
      family: 'red_team',
      scorer: 'true_false_scorer',
      tags: ['red-team'],
    },
    {
      id: 'harmful_output.jailbreak',
      display_name: 'Harmful Output Jailbreak',
      description: 'Solicit harmful output',
      family: 'harmful_output',
      scorer: 'content_classifier_scorer',
      tags: [],
    },
    {
      id: 'agentic_attack.toolchain',
      display_name: 'Agentic toolchain attack',
      description: 'Multi-step toolchain attack',
      family: 'agentic_attack',
      scorer: 'true_false_scorer',
      tags: [],
    },
    {
      id: 'sensitive_information.pii',
      display_name: 'PII extraction',
      description: 'Extract PII from RAG',
      family: 'sensitive_information',
      scorer: 'harm_category_scorer',
      tags: [],
    },
    {
      id: 'unmapped.thing',
      display_name: 'unmapped',
      description: 'unmapped',
      family: 'unmapped',
      scorer: 'true_false_scorer',
      tags: [],
    },
  ],
});

let spawner: MockSpawner;
let adapter: PyritAdapter;

beforeEach(() => {
  spawner = new MockSpawner();
  adapter = new PyritAdapter({
    spawner,
    executable: 'pyrit',
    version: '0.5.0',
  });
});

describe('PyritAdapter.listProbes', () => {
  it('returns translated descriptors with MIT license metadata', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    expect(probes).toHaveLength(5);
    for (const p of probes) {
      expect(p.provenance.upstreamLicense).toBe('MIT');
      expect(p.provenance.upstreamLibrary).toBe('pyrit');
      expect(p.provenance.upstreamVersion).toBe('0.5.0');
    }
  });

  it('attaches scorer tag for verdict mapping downstream', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    expect(probes[0]!.upstreamTags).toContain('scorer:true_false_scorer');
  });

  it('throws on non-zero exit', async () => {
    spawner.enqueue(failed('boom'));
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });

  it('throws on malformed JSON', async () => {
    spawner.enqueue(ok('not json'));
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });

  it('throws on schema mismatch', async () => {
    spawner.enqueue(ok(JSON.stringify({ wrong: 'shape' })));
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });
});

describe('PyritAdapter.translateToAuditForge', () => {
  it('maps harmful_output to A.6.2.6 toxicity', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const harm = probes.find((p) => p.upstreamId === 'harmful_output.jailbreak')!;
    const def = adapter.translateToAuditForge(harm, 1);
    expect(def.meta.controls.annexA).toContain('A.6.2.6');
    expect(def.meta.category).toBe('toxicity');
  });

  it('maps agentic_attack to A.6.2.7 + A.9 injection', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const ag = probes.find((p) => p.upstreamId === 'agentic_attack.toolchain')!;
    const def = adapter.translateToAuditForge(ag, 2);
    expect(def.meta.controls.annexA).toContain('A.6.2.7');
    expect(def.meta.controls.annexA).toContain('A.9');
    expect(def.meta.category).toBe('injection');
  });

  it('maps sensitive_information to A.7.4 leakage', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const si = probes.find((p) => p.upstreamId === 'sensitive_information.pii')!;
    const def = adapter.translateToAuditForge(si, 3);
    expect(def.meta.controls.annexA).toContain('A.7.4');
    expect(def.meta.category).toBe('leakage');
  });

  it('falls back to capability for unmapped', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const unk = probes.find((p) => p.upstreamId === 'unmapped.thing')!;
    const def = adapter.translateToAuditForge(unk, 4);
    expect(def.meta.category).toBe('capability');
  });

  it('produces P-PYR-NNN id', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const def = adapter.translateToAuditForge(probes[0]!, 7);
    expect(def.meta.id).toMatch(/^P-PYR-\d{3}$/);
  });

  it('PYRIT_MAPPING_RULES contains the four required families', () => {
    const families = PYRIT_MAPPING_RULES.map((r) => r.upstreamCategory);
    expect(families).toContain('harmful_output');
    expect(families).toContain('agentic_attack');
    expect(families).toContain('sensitive_information');
    expect(families).toContain('red_team');
  });
});

describe('PyritAdapter verdict mapping', () => {
  it('maps true_false_scorer true -> attack-succeeded', () => {
    expect(
      PyritAdapter.scoreToVerdictTag({
        scorer: 'true_false_scorer',
        value: true,
      }),
    ).toBe('attack-succeeded');
  });

  it('maps true_false_scorer false -> attack-blocked', () => {
    expect(
      PyritAdapter.scoreToVerdictTag({
        scorer: 'true_false_scorer',
        value: false,
      }),
    ).toBe('attack-blocked');
  });

  it('maps content_classifier_scorer "safe" -> safe-output', () => {
    expect(
      PyritAdapter.scoreToVerdictTag({
        scorer: 'content_classifier_scorer',
        value: 'safe',
      }),
    ).toBe('safe-output');
  });

  it('maps content_classifier_scorer "harmful" -> harmful-output', () => {
    expect(
      PyritAdapter.scoreToVerdictTag({
        scorer: 'content_classifier_scorer',
        value: 'harmful',
      }),
    ).toBe('harmful-output');
  });

  it('maps harm_category_scorer benign -> safe-output', () => {
    expect(
      PyritAdapter.scoreToVerdictTag({
        scorer: 'harm_category_scorer',
        value: 'benign',
        harm_category: 'benign',
      }),
    ).toBe('safe-output');
  });

  it('maps harm_category_scorer violence -> harmful-output', () => {
    expect(
      PyritAdapter.scoreToVerdictTag({
        scorer: 'harm_category_scorer',
        value: 'violence',
        harm_category: 'violence',
      }),
    ).toBe('harmful-output');
  });

  it('dominantVerdictTag picks the most severe', () => {
    expect(
      PyritAdapter.dominantVerdictTag([
        'safe-output',
        'attack-blocked',
        'harmful-output',
      ]),
    ).toBe('harmful-output');
    expect(
      PyritAdapter.dominantVerdictTag(['safe-output', 'attack-blocked']),
    ).toBe('attack-blocked');
    expect(PyritAdapter.dominantVerdictTag([])).toBe('inconclusive');
  });
});

describe('PyritAdapter.run', () => {
  const sandbox = new ProcessSandbox();

  it('normalises a successful run with content_classifier_scorer', async () => {
    const out = JSON.stringify({
      orchestrator: 'harmful_output.jailbreak',
      attempts: 4,
      successes: 1,
      scores: [
        { scorer: 'content_classifier_scorer', value: 'safe' },
        { scorer: 'content_classifier_scorer', value: 'harmful' },
        { scorer: 'content_classifier_scorer', value: 'safe' },
        { scorer: 'content_classifier_scorer', value: 'safe' },
      ],
      score: 0.75,
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-PYR-001',
      { upstreamId: 'harmful_output.jailbreak' },
      sandbox,
      policy,
    );
    // any harmful-output -> dominant tag harmful-output -> fail
    expect(r.verdict).toBe('fail');
    expect(r.score).toBe(0.75);
    expect(r.derivedMetrics['attempts']).toBe(4);
    expect(r.derivedMetrics['successes']).toBe(1);
  });

  it('returns pass when all scores are safe-output', async () => {
    const out = JSON.stringify({
      orchestrator: 'harmful_output.jailbreak',
      attempts: 2,
      successes: 0,
      scores: [
        { scorer: 'content_classifier_scorer', value: 'safe' },
        { scorer: 'content_classifier_scorer', value: 'safe' },
      ],
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-PYR-001',
      { upstreamId: 'harmful_output.jailbreak' },
      sandbox,
      policy,
    );
    expect(r.verdict).toBe('pass');
  });

  it('attaches MIT license metadata', async () => {
    const out = JSON.stringify({
      orchestrator: 'red_team.aligned_attack',
      attempts: 1,
      successes: 0,
      scores: [{ scorer: 'true_false_scorer', value: false }],
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-PYR-001',
      { upstreamId: 'red_team.aligned_attack' },
      sandbox,
      policy,
    );
    expect(r.derivedMetrics['upstreamLicense']).toBe('MIT');
    expect(r.derivedMetrics['upstreamLibrary']).toBe('pyrit');
    expect(r.provenance.upstreamLicense).toBe('MIT');
  });

  it('passes wallClockMaxMs from policy as spawn timeout', async () => {
    const out = JSON.stringify({
      orchestrator: 'red_team.aligned_attack',
      attempts: 0,
      successes: 0,
      scores: [],
    });
    spawner.enqueue(ok(out));
    await adapter.run(
      'P-PYR-001',
      { upstreamId: 'red_team.aligned_attack' },
      sandbox,
      policy,
    );
    expect(spawner.calls[0]!.opts.timeoutMs).toBe(90_000);
  });

  it('passes orchestrator args via stdin (not argv)', async () => {
    const out = JSON.stringify({
      orchestrator: 'red_team.aligned_attack',
      attempts: 0,
      successes: 0,
      scores: [],
    });
    spawner.enqueue(ok(out));
    await adapter.run(
      'P-PYR-001',
      {
        upstreamId: 'red_team.aligned_attack',
        upstreamArgs: { iterations: 5 },
      },
      sandbox,
      policy,
    );
    const call = spawner.calls[0]!;
    expect(call.opts.stdin).toBeTruthy();
    expect(call.opts.stdin).toContain('red_team.aligned_attack');
    expect(call.opts.stdin).toContain('"iterations":5');
    // argv must NOT contain the user-supplied iterations
    expect(call.args.join(' ')).not.toContain('iterations');
  });

  it('replay mode bypasses spawn', async () => {
    const r = await adapter.run(
      'P-PYR-001',
      {
        upstreamId: 'red_team.aligned_attack',
        replayPayload: {
          orchestrator: 'red_team.aligned_attack',
          attempts: 1,
          successes: 1,
          scores: [{ scorer: 'true_false_scorer', value: true }],
        },
      },
      sandbox,
      policy,
    );
    expect(spawner.calls).toHaveLength(0);
    expect(r.verdict).toBe('fail');
  });

  it('returns inconclusive when zero attempts', async () => {
    const out = JSON.stringify({
      orchestrator: 'red_team.aligned_attack',
      attempts: 0,
      successes: 0,
      scores: [],
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-PYR-001',
      { upstreamId: 'red_team.aligned_attack' },
      sandbox,
      policy,
    );
    expect(r.verdict).toBe('inconclusive');
  });

  it('throws on RUN_TIMEOUT', async () => {
    spawner.enqueue({ stdout: '', stderr: '', exitCode: -1, timedOut: true });
    await expect(
      adapter.run('P-PYR-001', { upstreamId: 'red_team.aligned_attack' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_TIMEOUT' });
  });

  it('throws on RUN_FAILED', async () => {
    spawner.enqueue(failed('crash', 2));
    await expect(
      adapter.run('P-PYR-001', { upstreamId: 'red_team.aligned_attack' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_FAILED' });
  });

  it('throws on RUN_MALFORMED', async () => {
    spawner.enqueue(ok('garbage'));
    await expect(
      adapter.run('P-PYR-001', { upstreamId: 'red_team.aligned_attack' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_MALFORMED' });
  });
});

describe('PyritAdapter.verifyEnvironment', () => {
  it('returns ok when version stdout contains "pyrit"', async () => {
    spawner.enqueue(ok('PyRIT 0.5.0'));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(true);
  });

  it('flags missing dependency on spawn throw', async () => {
    spawner.throwOnNext = new Error('ENOENT');
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it('flags non-zero exit', async () => {
    spawner.enqueue(failed('not found', 127));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
  });

  it('flags wrong binary on PATH', async () => {
    spawner.enqueue(ok('something-else 1.0'));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
  });
});
