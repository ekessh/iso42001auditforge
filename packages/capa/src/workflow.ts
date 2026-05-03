// SPDX-License-Identifier: BUSL-1.1
import type { CorrectiveAction, CaImplementation, CaVerification, EffectivenessOutcome } from './domain.js';
import { next } from './state-machine.js';

export interface CapaRepo {
  saveCa(ca: CorrectiveAction): Promise<void>;
  loadCa(id: string): Promise<CorrectiveAction | null>;
  saveImpl(impl: CaImplementation): Promise<void>;
  saveVerif(v: CaVerification): Promise<void>;
}

export interface CapaLedger { emit(eventType: string, payload: unknown): Promise<{ eventId: string }> }

export interface ReopenFinding { reopen(findingId: string): Promise<void> }

export class CapaWorkflow {
  constructor(
    private readonly repo: CapaRepo,
    private readonly ledger: CapaLedger,
    private readonly reopenFinding: ReopenFinding,
  ) {}

  async propose(ca: CorrectiveAction): Promise<void> {
    if (ca.status !== 'proposed') throw new Error('initial status must be proposed');
    await this.repo.saveCa(ca);
    await this.ledger.emit('capa.proposed', { caId: ca.id, findingId: ca.findingId });
  }

  async accept(caId: string): Promise<void> {
    const ca = await this.repo.loadCa(caId);
    if (!ca) throw new Error('CA not found');
    const updated = { ...ca, status: next(ca.status, 'auditor.accept') };
    await this.repo.saveCa(updated);
    await this.ledger.emit('capa.accepted', { caId });
  }

  async reject(caId: string, reason: string): Promise<void> {
    const ca = await this.repo.loadCa(caId);
    if (!ca) throw new Error('CA not found');
    const updated = { ...ca, status: next(ca.status, 'auditor.reject') };
    await this.repo.saveCa(updated);
    await this.ledger.emit('capa.rejected', { caId, reason });
  }

  async implement(impl: CaImplementation): Promise<void> {
    const ca = await this.repo.loadCa(impl.caId);
    if (!ca) throw new Error('CA not found');
    const updated = { ...ca, status: next(ca.status, 'auditee.implement') };
    await this.repo.saveCa(updated);
    await this.repo.saveImpl(impl);
    await this.ledger.emit('capa.implemented', { caId: impl.caId, evidenceCount: impl.evidenceIds.length });
  }

  async verify(v: CaVerification): Promise<void> {
    const ca = await this.repo.loadCa(v.caId);
    if (!ca) throw new Error('CA not found');
    if (v.outcome === 'ineffective') {
      await this.reopenFinding.reopen(ca.findingId);
      await this.ledger.emit('capa.verification_ineffective', { caId: v.caId, findingId: ca.findingId });
      return;
    }
    const updated = { ...ca, status: next(ca.status, 'auditor.verify') };
    await this.repo.saveCa(updated);
    await this.repo.saveVerif(v);
    await this.ledger.emit('capa.verified', { caId: v.caId, outcome: v.outcome });
  }

  async close(caId: string): Promise<void> {
    const ca = await this.repo.loadCa(caId);
    if (!ca) throw new Error('CA not found');
    const updated = { ...ca, status: next(ca.status, 'lead_auditor.close') };
    await this.repo.saveCa(updated);
    await this.ledger.emit('capa.closed', { caId });
  }
}

export function effectivenessIsTerminal(o: EffectivenessOutcome): boolean {
  return o === 'effective';
}
