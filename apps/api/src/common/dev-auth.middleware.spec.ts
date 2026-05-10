// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string | string[] | undefined> = {}): FastifyRequest {
  return { headers, auth: undefined } as unknown as FastifyRequest;
}

function makeRes(): FastifyReply {
  return {} as FastifyReply;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DevAuthMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDisable = process.env.AUDITFORGE_DISABLE_DEV_AUTH;

  afterEach(() => {
    // Restore env after each test.
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalDisable === undefined) {
      delete process.env.AUDITFORGE_DISABLE_DEV_AUTH;
    } else {
      process.env.AUDITFORGE_DISABLE_DEV_AUTH = originalDisable;
    }
    // Module cache is not resettable in vitest without vi.resetModules().
    vi.resetModules();
  });

  describe('constructor guards', () => {
    it('throws at construction when NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.AUDITFORGE_DISABLE_DEV_AUTH;

      const { DevAuthMiddleware } = await importMiddleware();
      expect(() => new DevAuthMiddleware()).toThrow(/FATAL.*production/i);
    });

    it('throws at construction when NODE_ENV is unset', async () => {
      delete process.env.NODE_ENV;
      delete process.env.AUDITFORGE_DISABLE_DEV_AUTH;

      const { DevAuthMiddleware } = await importMiddleware();
      expect(() => new DevAuthMiddleware()).toThrow(/NODE_ENV is unset/i);
    });

    it('does not throw when NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.AUDITFORGE_DISABLE_DEV_AUTH;

      const { DevAuthMiddleware } = await importMiddleware();
      expect(() => new DevAuthMiddleware()).not.toThrow();
    });

    it('does not throw when AUDITFORGE_DISABLE_DEV_AUTH=1 even if NODE_ENV unset', async () => {
      delete process.env.NODE_ENV;
      process.env.AUDITFORGE_DISABLE_DEV_AUTH = '1';

      const { DevAuthMiddleware } = await importMiddleware();
      expect(() => new DevAuthMiddleware()).not.toThrow();
    });
  });

  describe('request handling in development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      delete process.env.AUDITFORGE_DISABLE_DEV_AUTH;
    });

    it('sets req.auth when x-test-firm-id and x-test-auditor-id are present', async () => {
      const { DevAuthMiddleware } = await importMiddleware();
      const mw = new DevAuthMiddleware();
      const req = makeReq({
        'x-test-firm-id': 'firm-1',
        'x-test-auditor-id': 'aud-1',
      });
      const next = vi.fn();
      mw.use(req, makeRes(), next);
      expect(req.auth).toMatchObject({ firmId: 'firm-1', auditorId: 'aud-1', roles: ['lead_auditor'] });
      expect(next).toHaveBeenCalledOnce();
    });

    it('uses x-test-roles header when provided', async () => {
      const { DevAuthMiddleware } = await importMiddleware();
      const mw = new DevAuthMiddleware();
      const req = makeReq({
        'x-test-firm-id': 'firm-2',
        'x-test-auditor-id': 'aud-2',
        'x-test-roles': 'super_admin,firm_admin',
      });
      mw.use(req, makeRes(), vi.fn());
      expect(req.auth?.roles).toEqual(['super_admin', 'firm_admin']);
    });

    it('does not set req.auth when headers are missing', async () => {
      const { DevAuthMiddleware } = await importMiddleware();
      const mw = new DevAuthMiddleware();
      const req = makeReq({});
      mw.use(req, makeRes(), vi.fn());
      expect(req.auth).toBeUndefined();
    });

    it('ignores array-valued x-test-firm-id (prevents header injection)', async () => {
      const { DevAuthMiddleware } = await importMiddleware();
      const mw = new DevAuthMiddleware();
      const req = makeReq({
        'x-test-firm-id': ['firm-a', 'firm-b'], // array — must be rejected
        'x-test-auditor-id': 'aud-1',
      });
      mw.use(req, makeRes(), vi.fn());
      // firm-id was an array, so auth should not be set
      expect(req.auth).toBeUndefined();
    });
  });

  describe('production guard at request time', () => {
    it('x-test-firm-id is NOT honoured when NODE_ENV=production at request time', async () => {
      process.env.NODE_ENV = 'development';
      const { DevAuthMiddleware } = await importMiddleware();
      const mw = new DevAuthMiddleware();

      // Simulate env flipping to production before request (belt-and-suspenders).
      process.env.NODE_ENV = 'production';
      const req = makeReq({ 'x-test-firm-id': 'attacker', 'x-test-auditor-id': 'aud-x' });
      mw.use(req, makeRes(), vi.fn());
      expect(req.auth).toBeUndefined();
    });

    it('x-test-firm-id is NOT honoured when AUDITFORGE_DISABLE_DEV_AUTH=1 at request time', async () => {
      process.env.NODE_ENV = 'development';
      process.env.AUDITFORGE_DISABLE_DEV_AUTH = '1';
      const { DevAuthMiddleware } = await importMiddleware();
      const mw = new DevAuthMiddleware();
      const req = makeReq({ 'x-test-firm-id': 'attacker', 'x-test-auditor-id': 'aud-x' });
      mw.use(req, makeRes(), vi.fn());
      expect(req.auth).toBeUndefined();
    });
  });
});

// Dynamic import helper — needed so each test can load with fresh env.
async function importMiddleware() {
  // In the real test runner this would use import() or jest.resetModules().
  // We reference the local module via relative path for portability.
  const mod = await import('./dev-auth.middleware.js');
  return mod;
}
