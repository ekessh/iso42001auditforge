// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { DepsHealthService } from './deps-health.service.js';

class FakeSql {
  ok: boolean;
  constructor(ok: boolean) {
    this.ok = ok;
  }
  // Postgres tagged template signature
  async exec(): Promise<unknown[]> {
    if (!this.ok) throw new Error('pg down');
    return [{ '?column?': 1 }];
  }
}

function tag(ok: boolean): unknown {
  const fake = new FakeSql(ok);
  return ((..._args: unknown[]) => fake.exec()) as unknown;
}

class FakeRedis {
  ok: boolean;
  constructor(ok: boolean) {
    this.ok = ok;
  }
  async ping(): Promise<string> {
    if (!this.ok) throw new Error('redis down');
    return 'PONG';
  }
}

describe('DepsHealthService', () => {
  it('reports ok when db + redis up and optionals skipped', async () => {
    const svc = new DepsHealthService(
      tag(true) as never,
      new FakeRedis(true) as never,
    );
    const snap = await svc.snapshot();
    expect(snap.status).toBe('ok');
    expect(snap.deps.db.status).toBe('up');
    expect(snap.deps.redis.status).toBe('up');
    expect(snap.deps.meilisearch.status).toBe('skipped');
    expect(snap.deps.ollama.status).toBe('skipped');
    expect(snap.deps.tsa.status).toBe('skipped');
  });

  it('reports down when postgres is unhealthy', async () => {
    const svc = new DepsHealthService(
      tag(false) as never,
      new FakeRedis(true) as never,
    );
    const snap = await svc.snapshot();
    expect(snap.status).toBe('down');
    expect(snap.deps.db.status).toBe('down');
  });

  it('reports degraded when only an optional dep is down', async () => {
    const svc = new DepsHealthService(
      tag(true) as never,
      new FakeRedis(true) as never,
      { ping: async () => false },
    );
    const snap = await svc.snapshot();
    expect(snap.status).toBe('degraded');
    expect(snap.deps.meilisearch.status).toBe('down');
  });

  it('captures latencyMs in each dep result', async () => {
    const svc = new DepsHealthService(
      tag(true) as never,
      new FakeRedis(true) as never,
    );
    const snap = await svc.snapshot();
    expect(snap.deps.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(snap.deps.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('captures error detail on a failing dep', async () => {
    const svc = new DepsHealthService(
      tag(true) as never,
      new FakeRedis(false) as never,
    );
    const snap = await svc.snapshot();
    expect(snap.deps.redis.status).toBe('down');
    expect(snap.deps.redis.detail).toContain('redis down');
  });
});
