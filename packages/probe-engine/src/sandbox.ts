// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import type { ProbeRunContext, ProbeRunResult } from './dsl.js';
import type { ProbeBudget } from './types.js';

/**
 * Sandbox contract per ADR-0007.
 *
 * The probe-engine package does NOT enforce sandboxing — that lives in
 * `apps/worker` (Linux namespaces, seccomp, network policy). This module
 * exposes the contract the worker honours plus a `ProcessSandbox` stub the
 * unit-test suite uses to assert the runner respects the contract surface.
 */

export const EgressTargetSchema = z.object({
  /** "auditee" | "auditforge" | "third-party" — used for policy display. */
  kind: z.enum(['auditee', 'auditforge', 'third-party', 'localhost']),
  /** Wildcard hostname e.g. `api.openai.com` or `*.example.com`. */
  host: z.string().min(1),
  /** Allowed ports. Empty array means default port for protocol. */
  ports: z.array(z.number().int().min(1).max(65_535)).default([]),
  /** Allowed protocols. */
  protocols: z.array(z.enum(['https', 'http', 'wss', 'ws'])).default(['https']),
  /** Free-text reason — surfaces in the audit ledger. */
  rationale: z.string().min(1),
});
export type EgressTarget = z.infer<typeof EgressTargetSchema>;

export const SandboxPolicySchema = z.object({
  /** Egress allowlist; everything else is denied. */
  egressAllowlist: z.array(EgressTargetSchema),
  /** Wall-clock cap (ms). */
  wallClockMaxMs: z.number().int().positive(),
  /** CPU time cap (ms). */
  cpuMaxMs: z.number().int().positive(),
  /** Resident memory cap (MB). */
  memoryMaxMb: z.number().int().positive(),
  /** Per-execution outbound bandwidth cap (bytes). */
  bandwidthMaxBytes: z.number().int().positive().default(50 * 1024 * 1024),
  /** Read-only mounts available inside the sandbox. */
  readOnlyMounts: z.array(z.string().min(1)).default([]),
  /** Whether the sandbox may write a tmp dir (always tmpfs, capped). */
  tmpDirEnabled: z.boolean().default(true),
  /** Hard cap on tmp dir size (bytes). */
  tmpDirMaxBytes: z.number().int().positive().default(64 * 1024 * 1024),
  /** Whether the runner may invoke an inference client (set by mode + consent). */
  inferenceClientEnabled: z.boolean().default(false),
});
export type SandboxPolicy = z.infer<typeof SandboxPolicySchema>;

/**
 * Result of a sandboxed run as observed by the runner. The actual production
 * sandbox in `apps/worker` returns this shape over IPC.
 */
export interface SandboxResult<R = unknown> {
  readonly outcome: 'completed' | 'wallclock-timeout' | 'cpu-timeout' | 'oom' | 'egress-denied' | 'crashed';
  readonly result: ProbeRunResult<R> | null;
  readonly cpuMsUsed: number;
  readonly wallMsUsed: number;
  readonly memoryMaxMbObserved: number;
  readonly bandwidthBytesUsed: number;
  readonly egressDenials: ReadonlyArray<{
    target: string;
    reason: string;
  }>;
  readonly stderr: string;
}

/** Minimal sandbox interface; the worker provides the real implementation. */
export interface ProbeSandbox {
  /**
   * Execute a probe under the supplied policy.
   *
   * Implementations MUST:
   *   1. Verify policy.egressAllowlist matches the connector configuration
   *      before any code runs.
   *   2. Enforce wallClockMaxMs and CpuMaxMs, terminating the worker on breach.
   *   3. Cap memory using cgroups / rlimit; OOM-kill if exceeded.
   *   4. Capture stderr / stdout, redact known secret patterns before
   *      surfacing.
   *   5. Return a typed `SandboxResult` — never throw on probe failure.
   */
  execute<P, R>(args: {
    policy: SandboxPolicy;
    probeId: string;
    probeVersion: string;
    params: P;
    ctx: ProbeRunContext;
    runFn: (ctx: ProbeRunContext, params: P) => Promise<ProbeRunResult<R>>;
  }): Promise<SandboxResult<R>>;
}

/**
 * Helper: build a default policy from a probe budget + the engagement's
 * pre-approved egress targets.
 */
export function policyFromBudget(
  budget: ProbeBudget,
  approvedEgress: readonly EgressTarget[],
  inferenceClientEnabled: boolean,
): SandboxPolicy {
  return SandboxPolicySchema.parse({
    egressAllowlist: approvedEgress,
    wallClockMaxMs: budget.wallClockMaxMs,
    cpuMaxMs: budget.cpuMaxMs,
    memoryMaxMb: budget.memoryMaxMb,
    inferenceClientEnabled,
  });
}

/**
 * In-process sandbox stub used in unit tests. It honours the wall-clock cap
 * via `Promise.race` and reports CPU/memory as best-effort. It DOES NOT
 * provide isolation — production code MUST use the worker sandbox.
 */
export class ProcessSandbox implements ProbeSandbox {
  async execute<P, R>(args: {
    policy: SandboxPolicy;
    probeId: string;
    probeVersion: string;
    params: P;
    ctx: ProbeRunContext;
    runFn: (ctx: ProbeRunContext, params: P) => Promise<ProbeRunResult<R>>;
  }): Promise<SandboxResult<R>> {
    const { policy, params, ctx, runFn } = args;
    const start = Date.now();
    const cpuStart = process.cpuUsage();
    const memStart = process.memoryUsage().heapUsed;

    const timeout = new Promise<'wallclock-timeout'>((resolve) => {
      setTimeout(() => resolve('wallclock-timeout'), policy.wallClockMaxMs);
    });

    let result: ProbeRunResult<R> | null = null;
    let outcome: SandboxResult['outcome'] = 'completed';
    let stderr = '';

    try {
      const raced = await Promise.race([runFn(ctx, params), timeout]);
      if (raced === 'wallclock-timeout') {
        outcome = 'wallclock-timeout';
      } else {
        result = raced;
      }
    } catch (e) {
      outcome = 'crashed';
      stderr = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }

    const cpuEnd = process.cpuUsage(cpuStart);
    const wallMs = Date.now() - start;
    const memEnd = process.memoryUsage().heapUsed;
    const memMb = Math.max(0, Math.round((memEnd - memStart) / (1024 * 1024)));

    return {
      outcome,
      result,
      cpuMsUsed: Math.round((cpuEnd.user + cpuEnd.system) / 1000),
      wallMsUsed: wallMs,
      memoryMaxMbObserved: memMb,
      bandwidthBytesUsed: 0,
      egressDenials: [],
      stderr,
    };
  }
}
