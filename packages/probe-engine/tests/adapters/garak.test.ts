// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';

import { ProcessSandbox, type SandboxPolicy } from '../../src/sandbox.js';
import {
  ExternalAdapterError,
  type ProcessSpawner,
  type SpawnOptions,
  type SpawnResult,
} from '../../src/adapters/index.js';
import { GarakAdapter, GARAK_MAPPING_RULES } from '../../src/adapters/garak.js';

interface RecordedCall {
  command: string;
  args: readonly string[];
  opts: SpawnOptions;
}

class MockSpawner implements ProcessSpawner {
  public calls: RecordedCall[] = [];
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
  wallClockMaxMs: 60_000,
  cpuMaxMs: 30_000,
  memoryMaxMb: 512,
  bandwidthMaxBytes: 1024,
  readOnlyMounts: [],
  tmpDirEnabled: true,
  tmpDirMaxBytes: 1024,
  inferenceClientEnabled: false,
};

const SAMPLE_LIST = JSON.stringify({
  probes: [
    {
      name: 'dan.Dan_11_0',
      module: 'dan',
      description: 'DAN 11 jailbreak',
      tags: ['jailbreak'],
    },
    {
      name: 'promptinject.HijackHateHumans',
      module: 'promptinject',
      description: 'Hijack to hate humans',
      tags: ['injection'],
    },
    {
      name: 'leakreplay.GuardianHateSecrets',
      module: 'leakreplay',
      description: 'Replay leak of guardian secrets',
      tags: ['leakage'],
    },
    {
      name: 'lmrc.Profanity',
      module: 'lmrc',
      description: 'Profanity surfacing',
      tags: ['toxicity'],
    },
    {
      name: 'misleading.MustContradict',
      module: 'misleading',
      description: 'Misleading contradictions',
      tags: ['hallucination'],
    },
    {
      name: 'unknownfamily.X',
      module: 'unknownfamily',
      description: 'unmapped category',
      tags: [],
    },
  ],
});

const SAMPLE_REPORT = JSON.stringify({
  probe: 'dan.Dan_11_0',
  attempts: [
    { entry_type: 'attempt', probe: 'dan.Dan_11_0', triggered: true, prompt: 'p1', outputs: ['o1'] },
    { entry_type: 'attempt', probe: 'dan.Dan_11_0', triggered: false, prompt: 'p2', outputs: ['o2'] },
  ],
  summary: { attempts: 2, hits: 1, score: 0.5 },
});

let spawner: MockSpawner;
let adapter: GarakAdapter;

beforeEach(() => {
  spawner = new MockSpawner();
  adapter = new GarakAdapter({
    spawner,
    executable: 'garak',
    version: '0.10.0',
  });
});

describe('GarakAdapter.listProbes', () => {
  it('returns translated descriptors for every probe', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    expect(probes).toHaveLength(6);
    expect(probes.map((p) => p.upstreamId)).toContain('dan.Dan_11_0');
    expect(probes.map((p) => p.upstreamId)).toContain('promptinject.HijackHateHumans');
  });

  it('attaches Apache-2.0 license metadata to every descriptor', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    for (const p of probes) {
      expect(p.provenance.upstreamLicense).toBe('Apache-2.0');
      expect(p.provenance.upstreamLibrary).toBe('garak');
      expect(p.provenance.upstreamVersion).toBe('0.10.0');
    }
  });

  it('passes the upstream homepage on every descriptor', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    for (const p of probes) {
      expect(p.provenance.upstreamHomepage).toContain('NVIDIA/garak');
    }
  });

  it('throws ExternalAdapterError when spawn returns non-zero', async () => {
    spawner.enqueue(failed('boom', 2));
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });

  it('throws on malformed JSON', async () => {
    spawner.enqueue(ok('not-json'));
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });

  it('throws on schema mismatch', async () => {
    spawner.enqueue(ok(JSON.stringify({ wrong: 'shape' })));
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });

  it('throws on timeout', async () => {
    spawner.enqueue({ stdout: '', stderr: '', exitCode: -1, timedOut: true });
    await expect(adapter.listProbes()).rejects.toBeInstanceOf(ExternalAdapterError);
  });
});

describe('GarakAdapter.translateToAuditForge', () => {
  it('maps dan family to A.6.2.7 + OWASP LLM01', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const dan = probes.find((p) => p.upstreamId === 'dan.Dan_11_0')!;
    const def = adapter.translateToAuditForge(dan, 1);
    expect(def.meta.controls.annexA).toContain('A.6.2.7');
    expect(def.meta.controls.external).toEqual([
      { framework: 'OWASP_LLM_TOP10', id: 'LLM01' },
    ]);
    expect(def.meta.category).toBe('injection');
  });

  it('maps promptinject family to A.6.2.7 + OWASP LLM01', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const pi = probes.find((p) => p.upstreamId === 'promptinject.HijackHateHumans')!;
    const def = adapter.translateToAuditForge(pi, 2);
    expect(def.meta.controls.annexA).toContain('A.6.2.7');
    expect(def.meta.controls.external[0]?.id).toBe('LLM01');
  });

  it('maps leakreplay family to A.7.4 + OWASP LLM02', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const leak = probes.find((p) => p.upstreamId === 'leakreplay.GuardianHateSecrets')!;
    const def = adapter.translateToAuditForge(leak, 3);
    expect(def.meta.controls.annexA).toContain('A.7.4');
    expect(def.meta.controls.external[0]?.id).toBe('LLM02');
    expect(def.meta.category).toBe('leakage');
  });

  it('maps lmrc family to A.6.2.6 toxicity', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const lmrc = probes.find((p) => p.upstreamId === 'lmrc.Profanity')!;
    const def = adapter.translateToAuditForge(lmrc, 4);
    expect(def.meta.controls.annexA).toContain('A.6.2.6');
    expect(def.meta.category).toBe('toxicity');
  });

  it('maps misleading family to A.5.4 hallucination', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const mis = probes.find((p) => p.upstreamId === 'misleading.MustContradict')!;
    const def = adapter.translateToAuditForge(mis, 5);
    expect(def.meta.controls.annexA).toContain('A.5.4');
    expect(def.meta.category).toBe('hallucination');
  });

  it('falls back to capability for unmapped families', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const unk = probes.find((p) => p.upstreamId === 'unknownfamily.X')!;
    const def = adapter.translateToAuditForge(unk, 6);
    expect(def.meta.category).toBe('capability');
    expect(def.meta.controls.annexA).toEqual([]);
  });

  it('produces a P-GRK-NNN id', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const def = adapter.translateToAuditForge(probes[0]!, 42);
    expect(def.meta.id).toMatch(/^P-GRK-\d{3}$/);
  });

  it('tags probes as external + garak', async () => {
    spawner.enqueue(ok(SAMPLE_LIST));
    const probes = await adapter.listProbes();
    const def = adapter.translateToAuditForge(probes[0]!, 1);
    expect(def.meta.tags).toContain('external');
    expect(def.meta.tags).toContain('garak');
  });

  it('GARAK_MAPPING_RULES has every required family', () => {
    const families = GARAK_MAPPING_RULES.map((r) => r.upstreamCategory);
    expect(families).toContain('dan');
    expect(families).toContain('jailbreak');
    expect(families).toContain('promptinject');
    expect(families).toContain('leakreplay');
    expect(families).toContain('lmrc');
    expect(families).toContain('misleading');
  });
});

describe('GarakAdapter.run', () => {
  const sandbox = new ProcessSandbox();

  it('normalises a successful run report', async () => {
    spawner.enqueue(ok(SAMPLE_REPORT));
    const result = await adapter.run(
      'P-GRK-001',
      { upstreamId: 'dan.Dan_11_0' },
      sandbox,
      policy,
    );
    expect(result.derivedMetrics['attempts']).toBe(2);
    expect(result.derivedMetrics['hits']).toBe(1);
    expect(result.score).toBe(0.5);
    // half hits => attack-succeeded => fail
    expect(result.verdict).toBe('fail');
  });

  it('attaches license metadata on every result', async () => {
    spawner.enqueue(ok(SAMPLE_REPORT));
    const r = await adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy);
    expect(r.derivedMetrics['upstreamLicense']).toBe('Apache-2.0');
    expect(r.derivedMetrics['upstreamLibrary']).toBe('garak');
    expect(r.derivedMetrics['upstreamId']).toBe('dan.Dan_11_0');
    expect(r.provenance.upstreamLicense).toBe('Apache-2.0');
    expect(r.provenance.upstreamId).toBe('dan.Dan_11_0');
  });

  it('passes wallClockMaxMs from sandbox policy as spawn timeout', async () => {
    spawner.enqueue(ok(SAMPLE_REPORT));
    await adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy);
    expect(spawner.calls[0]!.opts.timeoutMs).toBe(policy.wallClockMaxMs);
  });

  it('returns inconclusive when there are zero attempts', async () => {
    const empty = JSON.stringify({
      probe: 'dan.Dan_11_0',
      attempts: [],
      summary: { attempts: 0, hits: 0 },
    });
    spawner.enqueue(ok(empty));
    const r = await adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy);
    expect(r.verdict).toBe('inconclusive');
  });

  it('returns pass when no hits', async () => {
    const allBlocked = JSON.stringify({
      probe: 'dan.Dan_11_0',
      attempts: [{ triggered: false }, { triggered: false }],
      summary: { attempts: 2, hits: 0, score: 1 },
    });
    spawner.enqueue(ok(allBlocked));
    const r = await adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy);
    expect(r.verdict).toBe('pass');
    expect(r.score).toBe(1);
  });

  it('throws on timeout', async () => {
    spawner.enqueue({ stdout: '', stderr: 'timeout', exitCode: -1, timedOut: true });
    await expect(
      adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_TIMEOUT' });
  });

  it('throws on non-zero exit', async () => {
    spawner.enqueue(failed('garak crashed'));
    await expect(
      adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_FAILED' });
  });

  it('throws on malformed run output', async () => {
    spawner.enqueue(ok('not json'));
    await expect(
      adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy),
    ).rejects.toMatchObject({ code: 'RUN_MALFORMED' });
  });

  it('replay mode bypasses spawn entirely', async () => {
    const r = await adapter.run(
      'P-GRK-001',
      {
        upstreamId: 'dan.Dan_11_0',
        replayPayload: JSON.parse(SAMPLE_REPORT),
      },
      sandbox,
      policy,
    );
    expect(spawner.calls).toHaveLength(0);
    expect(r.derivedMetrics['attempts']).toBe(2);
  });

  it('upstreamRaw is preserved verbatim for diffability', async () => {
    spawner.enqueue(ok(SAMPLE_REPORT));
    const r = await adapter.run('P-GRK-001', { upstreamId: 'dan.Dan_11_0' }, sandbox, policy);
    expect(r.rawResponse).toEqual(JSON.parse(SAMPLE_REPORT));
  });
});

describe('GarakAdapter.verifyEnvironment', () => {
  it('returns ok when garak --version succeeds and stdout contains "garak"', async () => {
    spawner.enqueue(ok('garak 0.10.0'));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(true);
    expect(c.reasons).toEqual([]);
  });

  it('returns not-ok when --version fails', async () => {
    spawner.enqueue(failed('command not found', 127));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it('returns not-ok when stdout does not mention garak', async () => {
    spawner.enqueue(ok('something-else 1.2.3'));
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
  });

  it('returns not-ok when spawn throws (Python missing)', async () => {
    spawner.throwOnNext = new Error('ENOENT: garak not installed');
    const c = await adapter.verifyEnvironment();
    expect(c.ok).toBe(false);
    expect(c.reasons[0]).toContain('failed to spawn');
  });
});
