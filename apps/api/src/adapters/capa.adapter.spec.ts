// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { CapaAdapter } from './capa.adapter.js';

const FIRM = '11111111-1111-1111-1111-111111111111';

describe('CapaAdapter', () => {
  let adapter: CapaAdapter;

  beforeEach(() => {
    adapter = new CapaAdapter(new AuditEngineAdapter());
  });

  it('creates capa rows via the registry', async () => {
    const r = await adapter.registry.create(FIRM, { name: 'CAPA-1' });
    expect(r.firmId).toBe(FIRM);
    expect(r.name).toBe('CAPA-1');
  });

  it('exposes the package state machine + workflow', () => {
    expect(typeof adapter.stateMachine.next).toBe('function');
    expect(typeof adapter.stateMachine.allowedActionsForRole).toBe('function');
    expect(typeof adapter.stateMachine.isTerminal).toBe('function');
    expect(adapter.workflow).toBeDefined();
  });

  it('isolates between firms', async () => {
    const r = await adapter.registry.create(FIRM, { name: 'CAPA-2' });
    const other = '22222222-2222-2222-2222-222222222222';
    await expect(adapter.registry.findById(other, r.id)).rejects.toThrow();
  });
});
