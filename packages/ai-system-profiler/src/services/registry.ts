// SPDX-License-Identifier: BUSL-1.1
import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictError,
  NotFoundError,
  type TenantContext,
  TenantContextSchema,
  TenantViolation,
  ValidationError,
  err,
  ok,
  type Result,
} from '../compat/shared.js';
import {
  type LedgerEmitter,
  NoopLedgerEmitter,
  type LedgerEvent,
} from '../compat/audit-engine.js';
import {
  AiSystemCreateInputSchema,
  AiSystemUpdateInputSchema,
  type AiSystem,
  type AiSystemCreateInput,
  type AiSystemUpdateInput,
  type AiSystemVersion,
} from '../types/ai-system.js';

/**
 * Storage adapter contract. The registry never talks to Postgres directly —
 * apps/api wires a Drizzle-backed adapter (Phase 1) that enforces RLS.
 * Tests use {@link InMemoryAiSystemStore}.
 */
export interface AiSystemStore {
  insert(record: AiSystem): Promise<void>;
  update(id: string, firmId: string, mutator: (cur: AiSystem) => AiSystem): Promise<AiSystem>;
  delete(id: string, firmId: string): Promise<void>;
  findById(id: string, firmId: string): Promise<AiSystem | undefined>;
  list(firmId: string, clientId?: string): Promise<readonly AiSystem[]>;
  insertVersion(version: AiSystemVersion): Promise<void>;
  listVersions(aiSystemId: string, firmId: string): Promise<readonly AiSystemVersion[]>;
}

/** Reference in-memory store; multi-tenant isolated by firmId. */
export class InMemoryAiSystemStore implements AiSystemStore {
  private readonly systems = new Map<string, AiSystem>();
  private readonly versions = new Map<string, AiSystemVersion[]>();

  async insert(record: AiSystem): Promise<void> {
    if (this.systems.has(record.id)) {
      throw new ConflictError(`AiSystem already exists: ${record.id}`);
    }
    this.systems.set(record.id, record);
  }
  async update(
    id: string,
    firmId: string,
    mutator: (cur: AiSystem) => AiSystem,
  ): Promise<AiSystem> {
    const cur = this.systems.get(id);
    if (!cur) throw new NotFoundError('AiSystem', id);
    if (cur.firmId !== firmId) throw new TenantViolation();
    const next = mutator(cur);
    this.systems.set(id, next);
    return next;
  }
  async delete(id: string, firmId: string): Promise<void> {
    const cur = this.systems.get(id);
    if (!cur) throw new NotFoundError('AiSystem', id);
    if (cur.firmId !== firmId) throw new TenantViolation();
    this.systems.delete(id);
    this.versions.delete(id);
  }
  async findById(id: string, firmId: string): Promise<AiSystem | undefined> {
    const cur = this.systems.get(id);
    if (!cur) return undefined;
    if (cur.firmId !== firmId) throw new TenantViolation();
    return cur;
  }
  async list(firmId: string, clientId?: string): Promise<readonly AiSystem[]> {
    const out: AiSystem[] = [];
    for (const s of this.systems.values()) {
      if (s.firmId !== firmId) continue;
      if (clientId !== undefined && s.clientId !== clientId) continue;
      out.push(s);
    }
    return out;
  }
  async insertVersion(version: AiSystemVersion): Promise<void> {
    const arr = this.versions.get(version.aiSystemId) ?? [];
    arr.push(version);
    this.versions.set(version.aiSystemId, arr);
  }
  async listVersions(aiSystemId: string, firmId: string): Promise<readonly AiSystemVersion[]> {
    const cur = this.systems.get(aiSystemId);
    if (cur && cur.firmId !== firmId) throw new TenantViolation();
    return this.versions.get(aiSystemId) ?? [];
  }
}

export interface AiSystemRegistryDeps {
  store: AiSystemStore;
  ledger?: LedgerEmitter;
  /** ISO timestamp generator — overridable for deterministic tests. */
  now?: () => string;
  /** UUID v4 generator — overridable for deterministic tests. */
  newId?: () => string;
}

/** Canonical-JSON SHA-256 over a snapshot, used for tamper-evident versioning. */
function snapshotHash(snapshot: AiSystem): string {
  const canonical = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * AiSystemRegistry — CRUD + versioning façade for AI systems with
 * tenancy hooks and audit-ledger emission. Used by apps/api Phase 2.
 *
 * ISO 42001 mapping:
 *  - clause 7.5 (documented information): every CRUD writes a ledger event
 *  - clause 8.2 (life-cycle): version snapshots preserve auditable history
 *  - Annex A.6.2 (system life-cycle): externalRef carries upstream lineage
 */
export class AiSystemRegistry {
  private readonly store: AiSystemStore;
  private readonly ledger: LedgerEmitter;
  private readonly now: () => string;
  private readonly newId: () => string;

  constructor(deps: AiSystemRegistryDeps) {
    this.store = deps.store;
    this.ledger = deps.ledger ?? new NoopLedgerEmitter();
    this.now = deps.now ?? (() => new Date().toISOString());
    this.newId = deps.newId ?? randomUUID;
  }

  /** Create an AI system. Tenant-scoped via {@link TenantContext}. */
  async create(
    tenant: TenantContext,
    input: AiSystemCreateInput,
  ): Promise<Result<AiSystem, ValidationError | TenantViolation>> {
    const tparse = TenantContextSchema.safeParse(tenant);
    if (!tparse.success) {
      return err(new ValidationError('invalid tenant context', { issues: tparse.error.issues }));
    }
    const parsed = AiSystemCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(new ValidationError('invalid AiSystem input', { issues: parsed.error.issues }));
    }
    if (parsed.data.kind !== parsed.data.intake.kind) {
      return err(
        new ValidationError(
          `kind/intake mismatch: kind=${parsed.data.kind} intake.kind=${parsed.data.intake.kind}`,
        ),
      );
    }
    const ts = this.now();
    const record: AiSystem = {
      id: this.newId(),
      firmId: tparse.data.firmId,
      clientId: parsed.data.clientId,
      ...(parsed.data.engagementId !== undefined ? { engagementId: parsed.data.engagementId } : {}),
      name: parsed.data.name,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      kind: parsed.data.kind,
      intake: parsed.data.intake,
      lifecycleStage: parsed.data.lifecycleStage,
      deploymentContext: parsed.data.deploymentContext,
      useCaseDescription: parsed.data.useCaseDescription,
      ...(parsed.data.externalRef !== undefined ? { externalRef: parsed.data.externalRef } : {}),
      sourceImporter: parsed.data.sourceImporter,
      riskClassification: { nistRecommendations: [], taxonomyMatches: [] },
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.insert(record);
    await this.emit({
      action: 'AI_SYSTEM_CREATED',
      resourceType: 'ai_system',
      resourceId: record.id,
      tenant: tparse.data,
      ...(tparse.data.auditorId !== undefined ? { actor: tparse.data.auditorId } : {}),
      timestamp: ts,
      payload: { kind: record.kind, name: record.name, sourceImporter: record.sourceImporter },
    });
    return ok(record);
  }

  /** Read by id. Returns NotFoundError if missing or cross-tenant. */
  async get(
    tenant: TenantContext,
    id: string,
  ): Promise<Result<AiSystem, NotFoundError | TenantViolation>> {
    try {
      const found = await this.store.findById(id, tenant.firmId);
      if (!found) return err(new NotFoundError('AiSystem', id));
      return ok(found);
    } catch (e) {
      if (e instanceof TenantViolation) return err(e);
      throw e;
    }
  }

  /** List systems for a firm, optionally scoped to a client. */
  async list(tenant: TenantContext, clientId?: string): Promise<readonly AiSystem[]> {
    return this.store.list(tenant.firmId, clientId);
  }

  /** Patch an AI system; emits AI_SYSTEM_UPDATED. */
  async update(
    tenant: TenantContext,
    id: string,
    patch: AiSystemUpdateInput,
  ): Promise<Result<AiSystem, ValidationError | NotFoundError | TenantViolation>> {
    const parsed = AiSystemUpdateInputSchema.safeParse(patch);
    if (!parsed.success) {
      return err(new ValidationError('invalid update', { issues: parsed.error.issues }));
    }
    if (
      parsed.data.intake !== undefined &&
      parsed.data.intake.kind !== undefined
    ) {
      // intake is a discriminated union — its kind must match the existing record's kind.
      const cur = await this.store.findById(id, tenant.firmId);
      if (!cur) return err(new NotFoundError('AiSystem', id));
      if (cur.kind !== parsed.data.intake.kind) {
        return err(
          new ValidationError(
            `intake.kind ${parsed.data.intake.kind} cannot replace existing kind ${cur.kind}`,
          ),
        );
      }
    }
    try {
      const next = await this.store.update(id, tenant.firmId, (cur) => {
        const merged: AiSystem = {
          ...cur,
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
          ...(parsed.data.intake !== undefined ? { intake: parsed.data.intake } : {}),
          ...(parsed.data.lifecycleStage !== undefined
            ? { lifecycleStage: parsed.data.lifecycleStage }
            : {}),
          ...(parsed.data.deploymentContext !== undefined
            ? { deploymentContext: parsed.data.deploymentContext }
            : {}),
          ...(parsed.data.useCaseDescription !== undefined
            ? { useCaseDescription: parsed.data.useCaseDescription }
            : {}),
          ...(parsed.data.externalRef !== undefined
            ? { externalRef: parsed.data.externalRef }
            : {}),
          updatedAt: this.now(),
        };
        return merged;
      });
      await this.emit({
        action: 'AI_SYSTEM_UPDATED',
        resourceType: 'ai_system',
        resourceId: id,
        tenant,
        ...(tenant.auditorId !== undefined ? { actor: tenant.auditorId } : {}),
        timestamp: next.updatedAt,
        payload: { fields: Object.keys(parsed.data) },
      });
      return ok(next);
    } catch (e) {
      if (e instanceof NotFoundError) return err(e);
      if (e instanceof TenantViolation) return err(e);
      throw e;
    }
  }

  /** Soft-delete (registry passes through to store). */
  async remove(
    tenant: TenantContext,
    id: string,
  ): Promise<Result<true, NotFoundError | TenantViolation>> {
    try {
      await this.store.delete(id, tenant.firmId);
      await this.emit({
        action: 'AI_SYSTEM_DELETED',
        resourceType: 'ai_system',
        resourceId: id,
        tenant,
        ...(tenant.auditorId !== undefined ? { actor: tenant.auditorId } : {}),
        timestamp: this.now(),
        payload: {},
      });
      return ok(true);
    } catch (e) {
      if (e instanceof NotFoundError) return err(e);
      if (e instanceof TenantViolation) return err(e);
      throw e;
    }
  }

  /**
   * Snapshot current state as an immutable AiSystemVersion. Required by
   * design § 3.3 — all findings reference the version of the AI system
   * that was current when evidence was gathered.
   */
  async snapshot(
    tenant: TenantContext,
    id: string,
    reason?: string,
  ): Promise<Result<AiSystemVersion, NotFoundError | TenantViolation>> {
    const r = await this.get(tenant, id);
    if (!r.ok) return r;
    const cur = r.value;
    const versions = await this.store.listVersions(id, tenant.firmId);
    const next: AiSystemVersion = {
      id: this.newId(),
      aiSystemId: id,
      version: versions.length + 1,
      snapshot: cur,
      snapshotHash: snapshotHash(cur),
      createdAt: this.now(),
      createdBy: tenant.auditorId ?? tenant.firmId,
      ...(reason !== undefined ? { reason } : {}),
    };
    await this.store.insertVersion(next);
    await this.emit({
      action: 'AI_SYSTEM_VERSION_SNAPSHOTTED',
      resourceType: 'ai_system_version',
      resourceId: next.id,
      tenant,
      ...(tenant.auditorId !== undefined ? { actor: tenant.auditorId } : {}),
      timestamp: next.createdAt,
      payload: { aiSystemId: id, version: next.version, snapshotHash: next.snapshotHash },
    });
    return ok(next);
  }

  /** Internal — push a {@link LedgerEvent} via the configured emitter. */
  private async emit(event: LedgerEvent): Promise<void> {
    await Promise.resolve(this.ledger.emit(event));
  }
}
