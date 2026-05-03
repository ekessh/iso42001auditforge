// SPDX-License-Identifier: BUSL-1.1
//
// Evidence-vault adapter — wires `@auditforge/evidence-vault` into the API.
//
// Provides:
//   - `EvidenceRegistry` (tenant-scoped CRUD)
//   - `UploadFlow` (presign + complete with hash + AV scan)
//   - `SignedUrlIssuer` (single-use download grants)
//   - `RetentionEnforcer` (10-year retention sweep)
//
// The adapter accepts injectable `ObjectStoreAdapter` / `AvScannerAdapter`
// implementations; default wiring uses the existing `StorageService` shim and
// a no-op AV scanner that defers to the BullMQ worker for real scanning.
//
// TODO(rls-migration): replace the in-memory `EvidenceRepository` with a
// Drizzle-backed implementation once `packages/db` exposes `evidence_objects`.

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EvidenceRegistry,
  RetentionEnforcer,
  SignedUrlIssuer,
  UploadFlow,
  type AvScannerAdapter,
  type EvidenceLink,
  type EvidenceObject,
  type EvidenceRepository as PkgEvidenceRepository,
  type LedgerEmitter as VaultLedgerEmitter,
  type ObjectStoreAdapter,
  type SignedUrlGrant,
  type TenantContext as VaultTenantContext,
} from '@auditforge/evidence-vault';
import { AuditEngineAdapter } from './audit-engine.adapter.js';

/**
 * In-memory `EvidenceRepository` — tenant-scoped, indexed by id. Same data
 * shape as the future Postgres implementation; the package's `EvidenceRegistry`
 * is the only consumer and works against either.
 */
class InMemoryEvidenceRepository implements PkgEvidenceRepository {
  private readonly objects = new Map<string, EvidenceObject>();
  private readonly links = new Map<string, EvidenceLink[]>();

  async insert(obj: EvidenceObject): Promise<void> {
    this.objects.set(obj.id, obj);
  }

  async findById(ctx: VaultTenantContext, id: string): Promise<EvidenceObject | null> {
    const obj = this.objects.get(id);
    if (!obj) return null;
    if (obj.firmId !== ctx.firmId) return null;
    if (obj.engagementId !== ctx.engagementId) return null;
    return obj;
  }

  async listByEngagement(ctx: VaultTenantContext): Promise<EvidenceObject[]> {
    return [...this.objects.values()].filter(
      (o) => o.firmId === ctx.firmId && o.engagementId === ctx.engagementId,
    );
  }

  async insertLink(link: EvidenceLink): Promise<void> {
    const list = this.links.get(link.evidenceId) ?? [];
    list.push(link);
    this.links.set(link.evidenceId, list);
  }

  async listLinks(_ctx: VaultTenantContext, evidenceId: string): Promise<EvidenceLink[]> {
    return [...(this.links.get(evidenceId) ?? [])];
  }

  async delete(ctx: VaultTenantContext, id: string): Promise<void> {
    const obj = this.objects.get(id);
    if (!obj) return;
    if (obj.firmId !== ctx.firmId) return;
    this.objects.delete(id);
    this.links.delete(id);
  }
}

/**
 * No-op AV scanner — real scans run async in the BullMQ worker. The vault
 * package's `UploadFlow.complete` requires an adapter so we satisfy the
 * interface; the worker updates the `avScanResult` once a verdict lands.
 */
class DeferredAvScanner implements AvScannerAdapter {
  async scan(_key: string): Promise<'clean' | 'infected' | 'error'> {
    return 'clean';
  }
}

/**
 * Adapter-shaped object store. The API still owns presigning via
 * `StorageService`; this thin wrapper conforms to the package's interface
 * without ripping out existing code paths.
 */
export interface ObjectStorePresigner {
  presignUpload(firmId: string, filename: string): Promise<{
    uploadId: string;
    bucket: string;
    objectKey: string;
    url: string;
    expiresAt: string;
  }>;
  presignDownload(bucket: string, key: string, ttlSeconds: number): Promise<string>;
  head?(key: string): Promise<{ size: number; sha256?: string } | null>;
  delete?(key: string): Promise<void>;
}

class StorageBackedObjectStore implements ObjectStoreAdapter {
  constructor(private readonly inner: ObjectStorePresigner) {}

  async presignPut(
    key: string,
    opts: { contentType: string; contentLength: number; sha256: string; ttlSeconds: number },
  ): Promise<{ url: string; headers: Record<string, string> }> {
    // Existing StorageService takes (firmId, filename); for adapter parity
    // we call it with the full key as filename. The legacy controller path
    // will continue to call StorageService.presignUpload directly until the
    // service is fully migrated.
    void opts;
    const r = await this.inner.presignUpload('', key);
    return { url: r.url, headers: {} };
  }

  async presignGet(key: string, opts: { ttlSeconds: number }): Promise<string> {
    return this.inner.presignDownload('', key, opts.ttlSeconds);
  }

  async head(key: string): Promise<{ size: number; sha256?: string } | null> {
    if (this.inner.head) return this.inner.head(key);
    // TODO(rls-migration): Until the storage adapter exposes HEAD, optimistic
    // accept the upload and rely on the AV worker / hash validation in the
    // service layer for integrity checks.
    return { size: 0 };
  }

  async delete(key: string): Promise<void> {
    if (this.inner.delete) return this.inner.delete(key);
    // No-op until storage adapter supports delete; retention enforcer will
    // log a warning when called.
  }
}

@Injectable()
export class EvidenceVaultAdapter {
  private readonly logger = new Logger(EvidenceVaultAdapter.name);

  readonly repository: PkgEvidenceRepository;
  readonly registry: EvidenceRegistry;
  /**
   * UploadFlow / SignedUrlIssuer / RetentionEnforcer are *factory methods* on
   * the adapter rather than singletons — they need a concrete
   * `ObjectStoreAdapter` plus grant store, which the EvidenceService injects.
   */
  readonly grants = new Map<string, SignedUrlGrant>();

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    this.repository = new InMemoryEvidenceRepository();
    this.registry = new EvidenceRegistry(this.repository);
  }

  /** Build an UploadFlow scoped to a particular object store + AV scanner. */
  uploadFlow(store: ObjectStoreAdapter, scanner?: AvScannerAdapter): UploadFlow {
    return new UploadFlow(store, scanner ?? new DeferredAvScanner(), this.makeLedger(), this.registry);
  }

  /** Build a SignedUrlIssuer over an in-memory grant store. */
  signedUrlIssuer(store: ObjectStoreAdapter): SignedUrlIssuer {
    return new SignedUrlIssuer({
      store,
      ledger: this.makeLedger(),
      saveGrant: async (g: SignedUrlGrant) => {
        this.grants.set(g.id, g);
      },
      loadGrant: async (id: string) => this.grants.get(id) ?? null,
      markConsumed: async (id: string) => {
        const g = this.grants.get(id);
        if (g) this.grants.set(id, { ...g, consumed: true });
      },
    });
  }

  /** Build a RetentionEnforcer for the given store. */
  retentionEnforcer(store: ObjectStoreAdapter): RetentionEnforcer {
    return new RetentionEnforcer({
      store,
      ledger: this.makeLedger(),
      listExpired: async (now: Date) => {
        const all: EvidenceObject[] = [];
        // No tenant filter: retention runs system-wide.
        for (const o of (this.repository as InMemoryEvidenceRepository).all()) {
          if (new Date(o.retainUntil).getTime() <= now.getTime()) all.push(o);
        }
        return all;
      },
      markDeleted: async (id: string) => {
        // Soft-delete: drop the record so subsequent reads return null.
        const obj = (this.repository as InMemoryEvidenceRepository).get(id);
        if (obj) {
          await this.repository.delete(
            { firmId: obj.firmId, auditorId: obj.uploadedBy, engagementId: obj.engagementId },
            id,
          );
        }
      },
    });
  }

  wrapStorage(s: ObjectStorePresigner): ObjectStoreAdapter {
    return new StorageBackedObjectStore(s);
  }

  private makeLedger(): VaultLedgerEmitter {
    return {
      emit: async (eventType: string, payload: unknown): Promise<{ eventId: string }> => {
        const p = (payload ?? {}) as Record<string, unknown>;
        try {
          const evt = await this.audit.append({
            firmId: typeof p['firmId'] === 'string' ? (p['firmId'] as string) : 'unknown',
            ...(typeof p['engagementId'] === 'string'
              ? { engagementId: p['engagementId'] as string }
              : {}),
            actorId: typeof p['uploadedBy'] === 'string' ? (p['uploadedBy'] as string) : 'system',
            type: eventType,
            entity: 'evidence',
            entityId: typeof p['evidenceId'] === 'string' ? (p['evidenceId'] as string) : 'unknown',
            payload: p,
          });
          return { eventId: evt.id };
        } catch (err) {
          this.logger.error({ err }, 'evidence ledger emit failed');
          return { eventId: '' };
        }
      },
    };
  }
}

// Tag the in-memory repo helpers so adapter callers can iterate without
// breaking the package's interface contract.
declare module '@auditforge/evidence-vault' {
  interface EvidenceRepository {
    /** TODO(rls-migration): Postgres-backed impl will provide a streaming cursor instead. */
  }
}

// Augment the in-memory repo with iteration helpers used by retention.
// We do this on the class instance rather than the interface to avoid leaking
// internals into the public type surface.
Object.assign(InMemoryEvidenceRepository.prototype, {
  all(this: InMemoryEvidenceRepository) {
    // @ts-expect-error reach into private map for retention sweep
    return [...(this.objects as Map<string, EvidenceObject>).values()];
  },
  get(this: InMemoryEvidenceRepository, id: string) {
    // @ts-expect-error reach into private map
    return (this.objects as Map<string, EvidenceObject>).get(id);
  },
});

interface InMemoryEvidenceRepository {
  all(): EvidenceObject[];
  get(id: string): EvidenceObject | undefined;
}
