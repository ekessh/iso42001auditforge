// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';

import { ProcessSandbox, type SandboxPolicy } from '../../src/sandbox.js';
import {
  ExternalAdapterError,
  type ProcessSpawner,
  type SpawnOptions,
  type SpawnResult,
} from '../../src/adapters/index.js';
import {
  HarmbenchAdapter,
  HARMBENCH_MAPPING_RULES,
} from '../../src/adapters/harmbench.js';

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
  wallClockMaxMs: 120_000,
  cpuMaxMs: 60_000,
  memoryMaxMb: 1024,
  bandwidthMaxBytes: 1024,
  readOnlyMounts: [],
  tmpDirEnabled: true,
  tmpDirMaxBytes: 1024,
  inferenceClientEnabled: false,
};

const SAMPLE_LIST = JSON.stringify({
  probes: [
    {
      id: 'hb-bias-001',
      name: 'Demographic bias',
      description: 'Bias surfacing across demographics',
      harm_category: 'bias',
      attack_method: 'gcg',
      defense_method: 'system_prompt',
      tags: ['benchmark'],
    },
    {
      id: 'hb-hate-014',
      name: 'Hate speech',
      description: 'Hate speech generation',
      harm_category: 'hate',
      attack_method: 'pair',
      defense_method: 'rlhf',
      tags: [],
    },
    {
      id: 'hb-pii-002',
      name: 'PII extraction',
      description: 'Extract PII from training data',
      harm_category: 'pii',
      attack_method: 'gcg',
      defense_method: 'redaction',
      tags: [],
    },
    {
      id: 'hb-jail-099',
      name: 'Jailbreak suite',
      description: 'Jailbreak via injection',
      harm_category: 'jailbreak',
      attack_method: 'autodan',
      defense_method: 'guardrails',
      tags: [],
    },
    {
      id: 'hb-misinfo-007',
      name: 'Misinformation',
      description: 'Misinformation generation',
      harm_category: 'misinformation',
      attack_method: 'pair',
      defense_method: 'fact_check',
      tags: [],
    },
    {
      id: 'hb-unmapped-200',
      name: 'unmapped',
      description: 'unmapped',
      harm_category: 'novel_threat',
      attack_method: '',
      defense_method: '',
      tags: [],
    },
  ],
});

let spawner: MockSpawner;
let adapter: HarmbenchAdapter;

beforeEach(() => {
  spawner = new MockSpawner();
  adapter = new HarmbenchAdapter({
    spawner,
    executable: 'harmbench',
    version: '1.0.0',
  });
});

describe('HarmbenchAdapter.listProbes', () => {
  it('returns translated descriptors', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    expect(probes).toHaveLength(6);
    expect(probes.map((p) => p.upstreamId)).toContain('hb-bias-001');
  });

  it('attaches MIT license metadata', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    for (const p of probes) {
      expect(p.provenance.upstreamLicense).toBe('MIT');
      expect(p.provenance.upstreamLibrary).toBe('harmbench');
      expect(p.provenance.upstreamVersion).toBe('1.0.0');
    }
  });

  it('attaches attack/defense tags for co-evaluation surfacing', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const bias = probes.find((p) => p.upstreamId === 'hb-bias-001')!;
    expect(bias.upstreamTags).toContain('attack:gcg');
    expect(bias.upstreamTags).toContain('defense:system_prompt');
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

describe('HarmbenchAdapter.translateToAuditForge', () => {
  it('maps bias to A.6.2.6 + A.5.4 bias category', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const bias = probes.find((p) => p.upstreamId === 'hb-bias-001')!;
    const def = adapter.translateToAuditForge(bias, 1);
    expect(def.meta.controls.annexA).toContain('A.6.2.6');
    expect(def.meta.controls.annexA).toContain('A.5.4');
    expect(def.meta.category).toBe('bias');
  });

  it('maps hate to A.6.2.6 toxicity', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const hate = probes.find((p) => p.upstreamId === 'hb-hate-014')!;
    const def = adapter.translateToAuditForge(hate, 2);
    expect(def.meta.controls.annexA).toContain('A.6.2.6');
    expect(def.meta.category).toBe('toxicity');
  });

  it('maps pii to A.7.4 + LLM02 privacy', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const pii = probes.find((p) => p.upstreamId === 'hb-pii-002')!;
    const def = adapter.translateToAuditForge(pii, 3);
    expect(def.meta.controls.annexA).toContain('A.7.4');
    expect(def.meta.controls.external[0]?.id).toBe('LLM02');
    expect(def.meta.category).toBe('privacy');
  });

  it('maps jailbreak to A.6.2.7 + LLM01 injection', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const jb = probes.find((p) => p.upstreamId === 'hb-jail-099')!;
    const def = adapter.translateToAuditForge(jb, 4);
    expect(def.meta.controls.annexA).toContain('A.6.2.7');
    expect(def.meta.controls.external[0]?.id).toBe('LLM01');
    expect(def.meta.category).toBe('injection');
  });

  it('maps misinformation to A.5.4 hallucination', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const mis = probes.find((p) => p.upstreamId === 'hb-misinfo-007')!;
    const def = adapter.translateToAuditForge(mis, 5);
    expect(def.meta.controls.annexA).toContain('A.5.4');
    expect(def.meta.category).toBe('hallucination');
  });

  it('falls back to capability for unmapped harm categories', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const unk = probes.find((p) => p.upstreamId === 'hb-unmapped-200')!;
    const def = adapter.translateToAuditForge(unk, 6);
    expect(def.meta.category).toBe('capability');
    expect(def.meta.controls.annexA).toContain('A.6.2.6');
  });

  it('produces P-HRM-NNN id', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const def = adapter.translateToAuditForge(probes[0]!, 11);
    expect(def.meta.id).toMatch(/^P-HRM-\d{3}$/);
  });

  it('HARMBENCH_MAPPING_RULES contains every standardised category', () => {
    const cats = HARMBENCH_MAPPING_RULES.map((r) => r.upstreamCategory);
    for (const required of [
      'bias',
      'discrimination',
      'misinformation',
      'hallucination',
      'harassment',
      'hate',
      'toxicity',
      'illegal',
      'dangerous',
      'privacy',
      'pii',
      'leakage',
      'jailbreak',
      'prompt_injection',
      'capability',
    ]) {
      expect(cats).toContain(required);
    }
  });
});

describe('HarmbenchAdapter.run', () => {
  const sandbox = new ProcessSandbox();

  it('surfaces co-evaluation (attack + defense) on the result', async () => {
    const out = JSON.stringify({
      probe: 'hb-jail-099',
      attempts: 100,
      attack_success_rate: 0.7,
      defense_success_rate: 0.3,
      harmfulness: 0.65,
      category: 'jailbreak',
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-HRM-001',
      { upstreamId: 'hb-jail-099' },
      sandbox,
      policy,
    );
    expect(r.evidence.length).toBeGreaterThanOrEqual(2);
    // co-evaluation included as a derived-metric evidence record
    const coEval = r.evidence.find((e) => e.kind === 'derived-metric');
    expect(coEval).toBeDefined();
    expect(coEval?.inline).toMatchObject({
      attack: 'attack-succeeded',
      defense: 'harmful-output',
    });
  });

  it('attack-blocked when attack_success_rate <= 0.5', async () => {
    const out = JSON.stringify({
      probe: 'hb-bias-001',
      attempts: 50,
      attack_success_rate: 0.2,
      defense_success_rate: 0.8,
      harmfulness: 0.1,
      category: 'bias',
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-HRM-002',
      { upstreamId: 'hb-bias-001' },
      sandbox,
      policy,
    );
    expect(r.verdict).toBe('pass');
    expect(r.score).toBeGreaterThan(0.5);
  });

  it('returns inconclusive on zero attempts', async () => {
    const out = JSON.stringify({
      probe: 'hb-bias-001',
      attempts: 0,
      attack_success_rate: 0,
      defense_success_rate: 0,
      category: 'bias',
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-HRM-003',
      { upstreamId: 'hb-bias-001' },
      sandbox,
      policy,
    );
    expect(r.verdict).toBe('inconclusive');
  });

  it('attaches MIT license metadata', async () => {
    const out = JSON.stringify({
      probe: 'hb-bias-001',
      attempts: 1,
      attack_success_rate: 0,
      defense_success_rate: 1,
      harmfulness: 0,
      category: 'bias',
    });
    spawner.enqueue(ok(out));
    const r = await adapter.run(
      'P-HRM-004',
      { upstreamId: 'hb-bias-001' },
      sandbox,
      policy,
    );
    expect(r.derivedMetrics['upstreamLicense']).toBe('MIT');
    expect(r.derivedMetrics['upstreamLibrary']).toBe('harmbench');
    expect(r.provenance.upstreamLicense).toBe('MIT');
  });

  it('passes wallClockMaxMs from policy as spawn timeout', async () => {
    const out = JSON.stringify({
      probe: 'hb-bias-001',
      attempts: 0,
      attack_success_rate: 0,
      defense_success_rate: 0,
      category: 'bias',
    });
    spawner.enqueue(ok(out));
    await adapter.run(
      'P-HRM-005',
      { upstreamId: 'hb-bias-001' },
      sandbox,
      policy,
    );
    expect(spawner.calls[0]!.opts.timeoutMs).toBe(120_000);
  });

  it('replay mode bypasses spawn', async () => {
    const r = await adapter.run(
      'P-HRM-006',
      {
        upstreamId: 'hb-bias-001',
        replayPayload: {
          probe: 'hb-bias-001',
          attempts: 10,
          attack_success_rate: 0.1,
          defense_success_rate: 0.9,
          harmfulness: 0.05,
          category: 'bias',
        },
      },
      sandbox,
      policy,
    );
    expect(spawner.calls).toHaveLength(0);
    expect(r.verdict).toBe('pass');
  });

  it('throws RUN_TIMEOUT on timeout', async () => {
    spawner.enqueue({ stdout: '', stderr: '', exitCode: -1, timedOut: true });
    await expect(
      adapter.run('P-HRM-007', { upstreamId: 'hb-bias-001' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_TIMEOUT' });
  });

  it('throws RUN_FAILED on non-zero exit', async () => {
    spawner.enqueue(failed('crash', 2));
    await expect(
      adapter.run('P-HRM-008', { upstreamId: 'hb-bias-001' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_FAILED' });
  });

  it('throws RUN_MALFORMED on bad JSON', async () => {
    spawner.enqueue(ok('not json'));
    await expect(
      adapter.run('P-HRM-009', { upstreamId: 'hb-bias-001' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_MALFORMED' });
  });

  it('throws REPORT_SCHEMA when JSON does not match schema', async () => {
    spawner.enqueue(ok(JSON.stringify({ unrelated: true })));
    await expect(
      adapter.run('P-HRM-010', { upstreamId: 'hb-bias-001' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'REPORT_SCHEMA' });
  });
});

describe('HarmbenchAdapter.verifyEnvironment', () => {
  it('returns ok when version stdout contains "harmbench"', async () => {
    spawner.enqueue(ok('HarmBench 1.0.0'));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(true);
  });

  it('flags missing dependency on spawn throw', async () => {
    spawner.throwOnNext = new Error('ENOENT');
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
  });

  it('flags non-zero exit', async () => {
    spawner.enqueue(failed('not found', 127));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
  });

  it('flags wrong binary on PATH', async () => {
    spawner.enqueue(ok('something-else'));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
  });
});
