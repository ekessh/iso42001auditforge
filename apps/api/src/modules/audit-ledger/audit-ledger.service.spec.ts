// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { AuditLedgerService } from './audit-ledger.service.js';

const firm = '11111111-1111-1111-1111-111111111111';

describe('AuditLedgerService', () => {
  it('verifies chain ok by default', async () => {
    const svc = new AuditLedgerService(new AuditEngineAdapter());
    const r = await svc.verify(firm);
    expect(r.ok).toBe(true);
    expect(r.verifiedAt).toBeDefined();
  });

  it('list returns empty page initially', async () => {
    const svc = new AuditLedgerService(new AuditEngineAdapter());
    const r = await svc.list(firm, { limit: 10 });
    expect(r.items).toEqual([]);
  });
});
