// SPDX-License-Identifier: BUSL-1.1
import type { AuditFileArchive, SignatureRecord, TsaToken } from './domain.js';
import { bundleManifestRoot, type BundleEntry } from './merkle.js';

export interface SnapshotProvider {
  collectBundle(engagementId: string): Promise<BundleEntry[]>;
}

export interface SignerProvider {
  requestSignatures(merkleRoot: string, signers: Array<{ id: string; role: SignatureRecord['signerRole'] }>): Promise<SignatureRecord[]>;
}

export interface TsaProvider {
  stamp(merkleRoot: string): Promise<TsaToken>;
}

export interface ArchiveStore {
  put(archive: AuditFileArchive): Promise<void>;
  isFrozen(engagementId: string): Promise<boolean>;
}

export interface LedgerEmitter { emit(eventType: string, payload: unknown): Promise<{ eventId: string }> }

export interface FreezeRequest {
  archiveId: string;
  firmId: string;
  engagementId: string;
  signers: Array<{ id: string; role: SignatureRecord['signerRole'] }>;
  retainUntil: string;
  bundleManifestKey: string;
}

export class FileFreezer {
  constructor(
    private readonly snapshot: SnapshotProvider,
    private readonly signer: SignerProvider,
    private readonly tsa: TsaProvider,
    private readonly store: ArchiveStore,
    private readonly ledger: LedgerEmitter,
  ) {}

  async freeze(req: FreezeRequest): Promise<AuditFileArchive> {
    if (await this.store.isFrozen(req.engagementId)) throw new Error('engagement already frozen');
    const entries = await this.snapshot.collectBundle(req.engagementId);
    const merkleRoot = bundleManifestRoot(entries);
    const signatures = await this.signer.requestSignatures(merkleRoot, req.signers);
    if (signatures.length < req.signers.length) throw new Error('not all signers responded');
    const tsaTokens = [await this.tsa.stamp(merkleRoot)];
    const archive: AuditFileArchive = {
      id: req.archiveId,
      firmId: req.firmId,
      engagementId: req.engagementId,
      frozenAt: new Date().toISOString(),
      bundleManifestKey: req.bundleManifestKey,
      merkleRoot,
      signatures,
      tsaTokens,
      retainUntil: req.retainUntil,
      status: 'active',
    };
    await this.store.put(archive);
    await this.ledger.emit('archive.frozen', {
      archiveId: archive.id, engagementId: archive.engagementId, merkleRoot, signers: signatures.length,
    });
    return archive;
  }
}
