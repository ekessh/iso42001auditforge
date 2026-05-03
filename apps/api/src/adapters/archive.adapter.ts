// SPDX-License-Identifier: BUSL-1.1
//
// Archive adapter — wires `@auditforge/archive` into the API.
//
// Provides:
//   - `FileFreezer` (Merkle-rooted freeze, multi-signer flow, TSA stamp)
//   - `IntegrityVerifier` (recompute Merkle root + verify signatures + TSA)
//   - `ArchiveRetentionEnforcer` (retention sweep — soft delete past retainUntil)
//   - `AccreditationPortalService` (single-use access grants)
//   - `LtvRenewalJob` (re-stamp TSA before token expiry)
//   - Tenant-scoped registry over the API DTO surface.
//
// The freezer is constructed with default in-memory ports (snapshot, signer,
// TSA, store). Each port is replaceable via the public setters so a host
// app can plug in:
//   - real `SnapshotProvider`     — bundles working papers / findings / etc.
//   - real `SignerProvider`       — multi-signer cert flow (lead auditor + peer reviewer)
//   - real `TsaProvider`          — RFC 3161 TSA endpoint
//   - real `ArchiveStore`         — Drizzle-backed persistence
//
// LTV renewal is exposed as a function `renewLtv()` that the BullMQ worker
// invokes on a cron schedule.
//
// TODO(integration): wire `SignerProvider` to the WebAuthn signing flow
// owned by `apps/api/src/modules/identity` once it exposes a server-side
// "request signature" surface.
// TODO(integration): wire `SnapshotProvider` to `working-papers`,
// `findings`, `evidence-vault`, `audit-ledger` exports once those modules
// expose a stable bundle export contract.

import { Inject, Injectable } from '@nestjs/common';
import {
  AccreditationPortalService,
  ArchiveRetentionEnforcer,
  FileFreezer,
  IntegrityVerifier,
  LtvRenewalJob,
  type AccessGrant,
  type AccessGrantRepo,
  type AccreditationLedger,
  type ArchiveStore,
  type AuditFileArchive,
  type FreezeRequest,
  type LedgerEmitter as ArchiveLedgerEmitter,
  type LtvDeps,
  type RetentionDeps,
  type SignatureRecord,
  type SignatureVerifier,
  type SignerProvider,
  type SnapshotProvider,
  type TsaProvider,
  type TsaToken,
  type TsaVerifier,
} from '@auditforge/archive';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { ArchiveDto, CreateArchiveDto, UpdateArchiveDto } from '../modules/archive/dto.js';

class InMemoryArchiveStore implements ArchiveStore {
  private readonly archives = new Map<string, AuditFileArchive>();
  private readonly byEngagement = new Map<string, string>();

  async put(archive: AuditFileArchive): Promise<void> {
    this.archives.set(archive.id, archive);
    this.byEngagement.set(archive.engagementId, archive.id);
  }
  async isFrozen(engagementId: string): Promise<boolean> {
    return this.byEngagement.has(engagementId);
  }
  /** Test helper. */
  list(): readonly AuditFileArchive[] {
    return Array.from(this.archives.values());
  }
  /** Test helper. */
  get(id: string): AuditFileArchive | undefined {
    return this.archives.get(id);
  }
  /** Internal — used by retention enforcer. */
  delete(id: string): void {
    const a = this.archives.get(id);
    if (a) {
      this.archives.delete(id);
      this.byEngagement.delete(a.engagementId);
    }
  }
  /** Internal — append a TSA token to an existing archive. */
  appendTsa(id: string, token: TsaToken): void {
    const a = this.archives.get(id);
    if (a) this.archives.set(id, { ...a, tsaTokens: [...a.tsaTokens, token] });
  }
}

class InMemoryAccessGrantRepo implements AccessGrantRepo {
  private readonly grants = new Map<string, AccessGrant>();
  async insert(grant: AccessGrant): Promise<void> {
    this.grants.set(grant.id, grant);
  }
  async load(id: string): Promise<AccessGrant | null> {
    return this.grants.get(id) ?? null;
  }
  async markConsumed(id: string, when: string): Promise<void> {
    const g = this.grants.get(id);
    if (g) this.grants.set(id, { ...g, consumedAt: when });
  }
}

/** Default `SignerProvider` — emits an unsigned placeholder per signer.
 *  The host swaps in a real signer (WebAuthn / mTLS) via setSignerProvider. */
class PlaceholderSignerProvider implements SignerProvider {
  async requestSignatures(
    merkleRoot: string,
    signers: Array<{ id: string; role: SignatureRecord['signerRole'] }>,
  ): Promise<SignatureRecord[]> {
    const at = new Date().toISOString();
    return signers.map((s) => ({
      signerId: s.id,
      signerRole: s.role,
      algorithm: 'placeholder',
      signedAt: at,
      // The real signer returns a base64 of the actual signature over the
      // Merkle root; placeholder echoes the root for traceability.
      signatureBase64: Buffer.from(merkleRoot, 'utf8').toString('base64'),
    }));
  }
}

/** Default `TsaProvider` — a deterministic local stamp.
 *  Production wires an RFC 3161 TSA via `setTsaProvider`. */
class LocalTsaProvider implements TsaProvider {
  async stamp(merkleRoot: string): Promise<TsaToken> {
    return {
      authority: 'local-placeholder',
      issuedAt: new Date().toISOString(),
      tokenBase64: Buffer.from(merkleRoot, 'utf8').toString('base64'),
    };
  }
}

/** Default no-op snapshot provider. */
class EmptySnapshotProvider implements SnapshotProvider {
  async collectBundle(): Promise<[]> {
    return [];
  }
}

@Injectable()
export class ArchiveAdapter {
  /** Underlying archive store (test-only access). */
  readonly store: InMemoryArchiveStore;

  /** Tenant-scoped registry over the API DTO. */
  readonly registry: TenantScopedRegistry<ArchiveDto, CreateArchiveDto, UpdateArchiveDto>;

  /** Replaceable hexagonal ports. */
  private snapshotProvider: SnapshotProvider = new EmptySnapshotProvider();
  private signerProvider: SignerProvider = new PlaceholderSignerProvider();
  private tsaProvider: TsaProvider = new LocalTsaProvider();
  private sigVerifier: SignatureVerifier = { async verify() { return true; } };
  private tsaVerifier: TsaVerifier = { async verify() { return true; } };

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    this.store = new InMemoryArchiveStore();
    this.registry = new TenantScopedRegistry<ArchiveDto, CreateArchiveDto, UpdateArchiveDto>(
      { entity: 'archive', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as ArchiveDto,
      'Archive',
    );
  }

  setSnapshotProvider(p: SnapshotProvider): void { this.snapshotProvider = p; }
  setSignerProvider(p: SignerProvider): void { this.signerProvider = p; }
  setTsaProvider(p: TsaProvider): void { this.tsaProvider = p; }
  setSignatureVerifier(v: SignatureVerifier): void { this.sigVerifier = v; }
  setTsaVerifier(v: TsaVerifier): void { this.tsaVerifier = v; }

  /** Build a `FileFreezer` with currently-configured ports. */
  freezer(): FileFreezer {
    return new FileFreezer(
      this.snapshotProvider,
      this.signerProvider,
      this.tsaProvider,
      this.store,
      this.makeLedger(),
    );
  }

  /** Convenience: freeze an engagement's audit file. Multi-signer is required. */
  async freezeEngagement(req: FreezeRequest): Promise<AuditFileArchive> {
    return this.freezer().freeze(req);
  }

  /** Build an integrity verifier with the configured signature/TSA verifiers. */
  integrity(): IntegrityVerifier {
    return new IntegrityVerifier(this.sigVerifier, this.tsaVerifier);
  }

  /** Run retention sweep — typically scheduled via BullMQ cron. */
  async runRetention(now = new Date()): Promise<{ deleted: number }> {
    const deps: RetentionDeps = {
      listExpired: async (n: Date) =>
        this.store.list().filter((a) => new Date(a.retainUntil) <= n).slice(),
      delete: async (a: AuditFileArchive) => {
        this.store.delete(a.id);
      },
      ledgerEmit: this.makeLedger().emit.bind(this.makeLedger()),
    };
    return new ArchiveRetentionEnforcer(deps).run(now);
  }

  /** Run LTV renewal — typically scheduled via BullMQ cron. */
  async renewLtv(now = new Date(), renewBeforeDays = 365): Promise<{ renewed: number }> {
    const deps: LtvDeps = {
      loadAll: async () => [...this.store.list()],
      saveTsa: async (id: string, token: TsaToken) => {
        this.store.appendTsa(id, token);
      },
      stampTsa: async (root: string) => this.tsaProvider.stamp(root),
      ledgerEmit: this.makeLedger().emit.bind(this.makeLedger()),
    };
    return new LtvRenewalJob(deps, renewBeforeDays).run(now);
  }

  /** Build an `AccreditationPortalService`. */
  accreditationPortal(repo?: AccessGrantRepo): AccreditationPortalService {
    const r = repo ?? new InMemoryAccessGrantRepo();
    const ledger: AccreditationLedger = this.makeLedger();
    return new AccreditationPortalService(r, ledger);
  }

  private makeLedger(): ArchiveLedgerEmitter {
    return {
      emit: async (eventType: string, payload: unknown) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        const evt = await this.audit.append({
          firmId: typeof p['firmId'] === 'string' ? (p['firmId'] as string) : 'unknown',
          actorId: 'system',
          type: eventType,
          entity: 'archive',
          entityId: typeof p['archiveId'] === 'string' ? (p['archiveId'] as string) : 'unknown',
          payload: p,
        });
        return { eventId: evt.id };
      },
    };
  }
}
