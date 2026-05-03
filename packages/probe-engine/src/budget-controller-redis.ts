// SPDX-License-Identifier: BUSL-1.1
//
// PERF / SAFETY — BLK-6 (perf-review #6):
// `InMemoryBudgetController` keeps state in a per-process `Map`. Two API
// replicas under load can race two preflight checks: both read $48 of
// $50 spent, both compute $48 + $5 < $50 = OK, both enqueue, ending at
// $58 spent. With cloud LLM enabled this is a real cost-leak surface,
// not just a missed metric.
//
// `RedisBudgetController` replaces the in-process `Map` with a Redis
// hash per engagement, and uses a Lua script for the atomic
// check-and-increment. Lua scripts run on the Redis server in a single
// step, so the projected-spend check and the increment cannot interleave
// across replicas. The same surface as `InMemoryBudgetController` is
// preserved so callers can swap implementations behind a config flag.
//
// Failure mode: Redis unavailable → fail-closed. The budget cannot be
// validated, so probes are blocked rather than silently accepted. This
// matches the audit-engineering preference of "do less, audibly" over
// "do more, silently".

import { ProbeBudgetExceeded } from '@auditforge/shared';

import type { ProbeBudget } from './types.js';
import type {
  BudgetController,
  BudgetSnapshot,
  EngagementBudget,
} from './budget-controller.js';

/**
 * Minimal Redis client surface — only the calls we actually use. Both
 * `ioredis` and `redis@4` satisfy this shape natively (`evalsha`,
 * `script`, `hgetall`, `hset`, `del`).
 *
 * We keep the surface small so the controller can be unit-tested with
 * an in-memory mock and the production deployment can pin to a single
 * client library at the application layer.
 */
export interface RedisLike {
  /**
   * Evaluate a Lua script. We use the call-time (eval) variant for
   * simplicity; production deployments may want to switch to `evalsha`
   * with a script cache to save bytes per call.
   */
  eval(
    script: string,
    numKeys: number,
    ...keysAndArgs: (string | number)[]
  ): Promise<unknown>;

  /** Read a hash. */
  hgetall(key: string): Promise<Record<string, string>>;

  /** Set arbitrary hash fields. Used by `setEngagementBudget`. */
  hset(key: string, values: Record<string, string | number>): Promise<unknown>;

  /** Delete a key (used by tests and admin reset). */
  del(key: string): Promise<unknown>;
}

/**
 * Lua script: atomic projected-spend check + increment + breach signal.
 *
 * KEYS[1]   budget hash key (per engagement)
 * ARGV[1]   command — "preflight" | "commit" | "approve"
 * ARGV[2]   cost delta (USD, float; 0 for offline/replay)
 * ARGV[3]   call delta (int)
 * ARGV[4]   default cost ceiling (USD)
 * ARGV[5]   default call ceiling
 * ARGV[6]   default warn threshold (USD)
 *
 * Returns a flat array:
 *   [verdict, projectedSpend, projectedCalls, costCeiling, callCeiling,
 *    warnThreshold, spent, calls, approved]
 *
 * `verdict` values:
 *   "ok"         — within budget; no commit
 *   "ok-commit"  — within budget; spend committed (commit command)
 *   "calls"      — call ceiling would be exceeded
 *   "cost"       — cost ceiling would be exceeded
 *   "warn"       — warn threshold reached, requires auditor approval
 *
 * The "evaluateAndCommit" command (named `commit`) is the one-call
 * Lua-atomic operation requested by the perf-review remediation: a
 * single round-trip that validates and persists the spend. Use it from
 * the worker's post-execution path so the budget cannot drift across
 * replicas.
 */
export const BUDGET_LUA_SCRIPT = `
local key = KEYS[1]
local cmd = ARGV[1]
local cost = tonumber(ARGV[2]) or 0
local calls = tonumber(ARGV[3]) or 0
local defCost = tonumber(ARGV[4])
local defCalls = tonumber(ARGV[5])
local defWarn = tonumber(ARGV[6])

-- Lazy-init: store defaults the first time we see this engagement.
local exists = redis.call('EXISTS', key)
if exists == 0 then
  redis.call('HMSET', key,
    'spentUsd', '0',
    'callsMade', '0',
    'approved', '0',
    'costCeilingUsd', tostring(defCost),
    'callCeiling', tostring(defCalls),
    'warnThresholdUsd', tostring(defWarn))
end

local spent = tonumber(redis.call('HGET', key, 'spentUsd')) or 0
local cmade = tonumber(redis.call('HGET', key, 'callsMade')) or 0
local approved = tonumber(redis.call('HGET', key, 'approved')) or 0
local costCeiling = tonumber(redis.call('HGET', key, 'costCeilingUsd')) or defCost
local callCeiling = tonumber(redis.call('HGET', key, 'callCeiling')) or defCalls
local warnThreshold = tonumber(redis.call('HGET', key, 'warnThresholdUsd')) or defWarn

if cmd == 'approve' then
  redis.call('HSET', key, 'approved', '1')
  return { 'ok', tostring(spent), tostring(cmade), tostring(costCeiling),
           tostring(callCeiling), tostring(warnThreshold),
           tostring(spent), tostring(cmade), '1' }
end

local projectedSpend = spent + cost
local projectedCalls = cmade + calls

if projectedCalls > callCeiling then
  return { 'calls', tostring(projectedSpend), tostring(projectedCalls), tostring(costCeiling),
           tostring(callCeiling), tostring(warnThreshold),
           tostring(spent), tostring(cmade), tostring(approved) }
end

if projectedSpend > costCeiling then
  return { 'cost', tostring(projectedSpend), tostring(projectedCalls), tostring(costCeiling),
           tostring(callCeiling), tostring(warnThreshold),
           tostring(spent), tostring(cmade), tostring(approved) }
end

if projectedSpend >= warnThreshold and approved == 0 then
  return { 'warn', tostring(projectedSpend), tostring(projectedCalls), tostring(costCeiling),
           tostring(callCeiling), tostring(warnThreshold),
           tostring(spent), tostring(cmade), tostring(approved) }
end

if cmd == 'commit' then
  redis.call('HINCRBYFLOAT', key, 'spentUsd', tostring(cost))
  redis.call('HINCRBY', key, 'callsMade', calls)
  spent = projectedSpend
  cmade = projectedCalls
  return { 'ok-commit', tostring(projectedSpend), tostring(projectedCalls), tostring(costCeiling),
           tostring(callCeiling), tostring(warnThreshold),
           tostring(spent), tostring(cmade), tostring(approved) }
end

return { 'ok', tostring(projectedSpend), tostring(projectedCalls), tostring(costCeiling),
         tostring(callCeiling), tostring(warnThreshold),
         tostring(spent), tostring(cmade), tostring(approved) }
`;

const DEFAULT_BUDGET: EngagementBudget = {
  costCeilingUsd: 100,
  callCeiling: 10_000,
  warnThresholdUsd: 80,
};

export interface RedisBudgetControllerOptions {
  /** Key prefix for budget hashes. Defaults to `auditforge:budget:`. */
  keyPrefix?: string;
  /** Default ceilings used when an engagement has no configured budget. */
  defaultBudget?: EngagementBudget;
  /** Optional logger for fail-closed events. */
  logger?: { warn(msg: string, err?: unknown): void };
}

/**
 * Multi-replica safe budget controller. The class is sync on the typed
 * surface (matching `InMemoryBudgetController`); Redis IO is awaited
 * internally before any of the predicate-throwing methods return. Note
 * that the package's `BudgetController` interface declares `preflight`
 * and `recordSpend` as void-returning sync methods; the concrete async
 * shape is exposed via the `*Async` suffixed twins. Callers in the
 * worker / api use the async variants directly.
 */
export class RedisBudgetController implements BudgetController {
  private readonly keyPrefix: string;
  private readonly defaults: EngagementBudget;
  private readonly logger?: { warn(msg: string, err?: unknown): void };

  constructor(
    private readonly redis: RedisLike,
    opts: RedisBudgetControllerOptions = {},
  ) {
    this.keyPrefix = opts.keyPrefix ?? 'auditforge:budget:';
    this.defaults = opts.defaultBudget ?? DEFAULT_BUDGET;
    this.logger = opts.logger;
  }

  private key(engagementId: string): string {
    return `${this.keyPrefix}${engagementId}`;
  }

  /**
   * Set / replace the engagement budget. Writes ceilings without
   * touching the running spend, so changing the cap mid-engagement
   * preserves history.
   */
  async setEngagementBudgetAsync(
    engagementId: string,
    budget: EngagementBudget,
  ): Promise<void> {
    if (
      budget.costCeilingUsd < 0 ||
      budget.callCeiling < 0 ||
      budget.warnThresholdUsd < 0 ||
      budget.warnThresholdUsd > budget.costCeilingUsd
    ) {
      throw new Error('invalid budget: thresholds must be non-negative and warn <= ceiling');
    }
    await this.redis.hset(this.key(engagementId), {
      costCeilingUsd: budget.costCeilingUsd,
      callCeiling: budget.callCeiling,
      warnThresholdUsd: budget.warnThresholdUsd,
    });
  }

  /**
   * Async preflight (Lua-atomic). Throws `ProbeBudgetExceeded` when the
   * projected spend would breach a ceiling or the warn threshold (and
   * the engagement hasn't been approved over-threshold yet).
   */
  async preflightAsync(
    engagementId: string,
    probeId: string,
    budget: ProbeBudget,
    mode: 'offline' | 'live' | 'replay',
  ): Promise<void> {
    const cost = mode === 'live' ? budget.costEstimateUsd : 0;
    const calls = mode === 'live' ? budget.estimatedCallsMax : 0;
    const r = await this.evalSafe(engagementId, 'preflight', cost, calls);
    this.assertVerdict(engagementId, probeId, r);
  }

  /**
   * Lua-atomic preflight + commit in one round-trip. Use this from the
   * worker's post-execution path to record the actual spend without a
   * second network hop. The "commit" command also runs the breach
   * predicates so a hard cap reached between preflight and execution
   * still rolls back the commit cleanly.
   */
  async evaluateAndCommit(
    engagementId: string,
    costUsd: number,
    callsMade = 0,
  ): Promise<BudgetSnapshot> {
    if (costUsd < 0 || callsMade < 0) {
      throw new Error('evaluateAndCommit: negative values rejected');
    }
    const r = await this.evalSafe(engagementId, 'commit', costUsd, callsMade);
    this.assertVerdict(engagementId, 'commit', r);
    return this.snapshotFromResult(engagementId, r);
  }

  /** Async record-spend without preflight. Same contract as in-memory. */
  async recordSpendAsync(
    engagementId: string,
    costUsd: number,
    callsMade: number,
  ): Promise<void> {
    if (costUsd < 0 || callsMade < 0) {
      throw new Error('recordSpend: negative values rejected');
    }
    // We don't go through Lua here — straight HINCRBY is atomic on
    // single-key operations, and we don't need the breach predicates.
    await this.redis.eval(
      `redis.call('HINCRBYFLOAT', KEYS[1], 'spentUsd', ARGV[1])
       redis.call('HINCRBY', KEYS[1], 'callsMade', ARGV[2])
       return 1`,
      1,
      this.key(engagementId),
      costUsd,
      callsMade,
    );
  }

  /** Mark the engagement as approved-over-threshold. Atomic. */
  async approveOverThresholdAsync(engagementId: string): Promise<void> {
    await this.evalSafe(engagementId, 'approve', 0, 0);
  }

  /** Read the current snapshot. One round-trip, no Lua. */
  async snapshotAsync(engagementId: string): Promise<BudgetSnapshot> {
    const raw = await this.redis.hgetall(this.key(engagementId));
    return {
      engagementId,
      costCeilingUsd: parseFloat(raw['costCeilingUsd'] ?? '') || this.defaults.costCeilingUsd,
      callCeiling: parseInt(raw['callCeiling'] ?? '', 10) || this.defaults.callCeiling,
      warnThresholdUsd:
        parseFloat(raw['warnThresholdUsd'] ?? '') || this.defaults.warnThresholdUsd,
      spentUsd: parseFloat(raw['spentUsd'] ?? '0') || 0,
      callsMade: parseInt(raw['callsMade'] ?? '0', 10) || 0,
      approvedOverThreshold: raw['approved'] === '1',
    };
  }

  // ----- Sync surface required by `BudgetController` -----
  // The original interface declares void-returning methods; we keep the
  // shape but funnel through the async path. Callers that need the
  // void-call ergonomics can fire-and-forget; new callers should use
  // the *Async methods to surface failures.

  setEngagementBudget(engagementId: string, budget: EngagementBudget): void {
    void this.setEngagementBudgetAsync(engagementId, budget).catch((err) =>
      this.logger?.warn('setEngagementBudget failed', err),
    );
  }

  preflight(
    engagementId: string,
    probeId: string,
    budget: ProbeBudget,
    mode: 'offline' | 'live' | 'replay',
  ): void {
    // The interface contract is sync-throwing; we cannot honour that
    // safely against a network store. Throw a clear error so callers
    // migrate to `preflightAsync`.
    throw new Error(
      'RedisBudgetController.preflight is async — call preflightAsync(' +
        `${engagementId}, ${probeId}, …, ${mode}) instead.`,
    );
  }

  recordSpend(_engagementId: string, _costUsd: number, _callsMade: number): void {
    throw new Error('RedisBudgetController.recordSpend is async — call recordSpendAsync.');
  }

  approveOverThreshold(_engagementId: string): void {
    throw new Error(
      'RedisBudgetController.approveOverThreshold is async — call approveOverThresholdAsync.',
    );
  }

  snapshot(_engagementId: string): BudgetSnapshot {
    throw new Error('RedisBudgetController.snapshot is async — call snapshotAsync.');
  }

  // ----- internals -----

  private async evalSafe(
    engagementId: string,
    cmd: 'preflight' | 'commit' | 'approve',
    cost: number,
    calls: number,
  ): Promise<string[]> {
    try {
      const out = (await this.redis.eval(
        BUDGET_LUA_SCRIPT,
        1,
        this.key(engagementId),
        cmd,
        cost,
        calls,
        this.defaults.costCeilingUsd,
        this.defaults.callCeiling,
        this.defaults.warnThresholdUsd,
      )) as unknown[];
      return (out as unknown[]).map((v) => String(v));
    } catch (err) {
      // Fail-closed: Redis unavailable → block all spend. We surface
      // this as a `ProbeBudgetExceeded` with a distinct error code so
      // operators can alert on the difference between "real breach" and
      // "infrastructure outage".
      this.logger?.warn('budget controller redis unavailable; failing closed', err);
      throw new ProbeBudgetExceeded('Budget controller unavailable (fail-closed)', {
        engagementId,
        reason: 'redis-unavailable',
        underlying: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private assertVerdict(
    engagementId: string,
    probeId: string,
    r: readonly string[],
  ): void {
    const verdict = r[0];
    if (verdict === 'ok' || verdict === 'ok-commit') return;
    if (verdict === 'calls') {
      throw new ProbeBudgetExceeded('Call ceiling would be exceeded', {
        engagementId,
        probeId,
        projectedCalls: Number(r[2]),
        callCeiling: Number(r[4]),
      });
    }
    if (verdict === 'cost') {
      throw new ProbeBudgetExceeded('Cost ceiling would be exceeded', {
        engagementId,
        probeId,
        projectedSpend: Number(r[1]),
        costCeiling: Number(r[3]),
      });
    }
    if (verdict === 'warn') {
      throw new ProbeBudgetExceeded('Auditor confirmation required: warn threshold reached', {
        engagementId,
        probeId,
        projectedSpend: Number(r[1]),
        warnThreshold: Number(r[5]),
        requiresApproval: true,
      });
    }
    throw new ProbeBudgetExceeded(`Unknown budget verdict: ${verdict}`, {
      engagementId,
      probeId,
    });
  }

  private snapshotFromResult(
    engagementId: string,
    r: readonly string[],
  ): BudgetSnapshot {
    return {
      engagementId,
      costCeilingUsd: Number(r[3]),
      callCeiling: Number(r[4]),
      warnThresholdUsd: Number(r[5]),
      spentUsd: Number(r[6]),
      callsMade: Number(r[7]),
      approvedOverThreshold: r[8] === '1',
    };
  }
}
