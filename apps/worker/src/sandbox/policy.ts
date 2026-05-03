// SPDX-License-Identifier: BUSL-1.1
/**
 * Sandbox policy interface for probe execution per ADR-0007.
 *
 * Production enforcement is container-level (network namespace + egress
 * proxy). The runtime checks here are an additional in-process guard.
 */

export interface ResourceCaps {
  cpuMs: number;
  memMb: number;
  wallclockMs: number;
  allowedHosts: readonly string[];
}

export interface SandboxPolicy {
  isHostAllowed(host: string): boolean;
  caps(): ResourceCaps;
}

export class AllowlistSandboxPolicy implements SandboxPolicy {
  constructor(private readonly capacity: ResourceCaps) {}

  isHostAllowed(host: string): boolean {
    if (!this.capacity.allowedHosts.length) return false;
    const norm = host.toLowerCase();
    return this.capacity.allowedHosts.some((h) => {
      const allowed = h.trim().toLowerCase();
      if (!allowed) return false;
      if (allowed.startsWith('*.')) return norm.endsWith(allowed.slice(1));
      return norm === allowed;
    });
  }

  caps(): ResourceCaps { return this.capacity; }
}

export class ProbeBudgetExceededError extends Error {
  constructor(public readonly limit: number, public readonly attempted: number) {
    super(`Probe budget exceeded: attempted ${attempted}, limit ${limit}`);
    this.name = 'ProbeBudgetExceededError';
  }
}

export class SandboxViolationError extends Error {
  constructor(reason: string) {
    super(`Sandbox violation: ${reason}`);
    this.name = 'SandboxViolationError';
  }
}

export async function withWallclock<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_resolve, reject) => {
        ctrl.signal.addEventListener('abort', () => reject(new SandboxViolationError(`wallclock exceeded ${ms}ms`)));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
