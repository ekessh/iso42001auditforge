// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { AllowlistSandboxPolicy, withWallclock, SandboxViolationError } from './policy.js';

describe('AllowlistSandboxPolicy', () => {
  it('blocks empty allowlist', () => {
    const p = new AllowlistSandboxPolicy({ cpuMs: 100, memMb: 100, wallclockMs: 100, allowedHosts: [] });
    expect(p.isHostAllowed('inference.example.com')).toBe(false);
  });

  it('allows exact match', () => {
    const p = new AllowlistSandboxPolicy({ cpuMs: 100, memMb: 100, wallclockMs: 100, allowedHosts: ['inference.example.com'] });
    expect(p.isHostAllowed('inference.example.com')).toBe(true);
    expect(p.isHostAllowed('attacker.example.com')).toBe(false);
  });

  it('allows wildcard subdomain', () => {
    const p = new AllowlistSandboxPolicy({ cpuMs: 100, memMb: 100, wallclockMs: 100, allowedHosts: ['*.example.com'] });
    expect(p.isHostAllowed('a.example.com')).toBe(true);
    expect(p.isHostAllowed('example.com')).toBe(false);
  });

  it('case-insensitive', () => {
    const p = new AllowlistSandboxPolicy({ cpuMs: 100, memMb: 100, wallclockMs: 100, allowedHosts: ['EXAMPLE.com'] });
    expect(p.isHostAllowed('example.com')).toBe(true);
  });

  it('caps return configured values', () => {
    const p = new AllowlistSandboxPolicy({ cpuMs: 1, memMb: 2, wallclockMs: 3, allowedHosts: ['x'] });
    expect(p.caps()).toEqual({ cpuMs: 1, memMb: 2, wallclockMs: 3, allowedHosts: ['x'] });
  });
});

describe('withWallclock', () => {
  it('resolves under wallclock', async () => {
    const r = await withWallclock(1_000, async () => 'ok');
    expect(r).toBe('ok');
  });

  it('rejects on wallclock exceeded', async () => {
    await expect(
      withWallclock(20, () => new Promise<string>((res) => setTimeout(() => res('late'), 200))),
    ).rejects.toBeInstanceOf(SandboxViolationError);
  });
});
