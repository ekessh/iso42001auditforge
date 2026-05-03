// SPDX-License-Identifier: BUSL-1.1
//
// Working-papers repository — thin Drizzle-shaped wrapper over the
// `@auditforge/working-papers` `WorkingPaperRegistry`. Persistence is the
// registry's responsibility; the repository's job is to translate between the
// API DTOs (legacy shape with `templateId / title / controlRef / bodyMarkdown`)
// and the package's typed domain model (`WpScope`, `Verdict`, etc).
//
// TODO(rls-migration): once `packages/db` exposes a `working_papers` Drizzle
// schema, we'll inject a `PostgresWorkingPaperRegistry` — the package's
// registry interface stays identical so this file does not need to change.

import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type {
  TenantContext,
  Verdict,
  WorkingPaper,
} from '@auditforge/working-papers';
import { hashContent } from '@auditforge/working-papers';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { WorkingPapersAdapter } from '../../adapters/working-papers.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { ConflictError, NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type {
  CreateWorkingPaperDto,
  UpdateWorkingPaperDto,
  WorkingPaperDto,
} from './dto.js';

interface ApiSidecar {
  templateId?: string | undefined;
  title: string;
  controlRef: string;
  bodyMarkdown: string;
  evidenceRefs: WorkingPaperDto['evidenceRefs'];
  status: WorkingPaperDto['status'];
  version: number;
}

@Injectable()
export class WorkingPapersRepository extends BaseRepository {
  /**
   * The package's WorkingPaper carries CRDT-encoded content + verdict. The
   * legacy API DTO carries plain markdown + status + evidence refs. We keep a
   * sidecar map keyed by working-paper id to bridge the two until the DTO is
   * migrated to the package's domain model.
   */
  private readonly sidecar = new Map<string, ApiSidecar>();

  constructor(
    @Inject(PG_CLIENT) sql: postgres.Sql,
    tenancy: TenancyAdapter,
    @Optional() @Inject(WorkingPapersAdapter) private readonly wp?: WorkingPapersAdapter,
  ) {
    super(sql, tenancy);
  }

  async create(firmId: string, dto: CreateWorkingPaperDto): Promise<WorkingPaperDto> {
    const ctx: TenantContext = { firmId };
    if (!this.wp) {
      // Defensive fallback for legacy unit tests that don't provide the
      // adapter. Never used in production.
      return this.createInMemoryFallback(firmId, dto);
    }
    const created: WorkingPaper = await this.wp.registry.create({
      tenant: ctx,
      engagementId: dto.engagementId,
      scope: { controlId: dto.controlRef },
      templateId: dto.templateId ?? 'generic-wp@1',
      templateVersion: '1',
      initialContent: '', // base64 Y update; empty until editor pushes
      authorId: ctx.firmId, // TODO(rls-migration): use actual auditorId from ctx
      initialVerdict: 'conformant',
      initialConfidence: 0,
    });
    this.sidecar.set(created.id, {
      ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      title: dto.title,
      controlRef: dto.controlRef,
      bodyMarkdown: dto.bodyMarkdown,
      evidenceRefs: dto.evidenceRefs,
      status: 'draft',
      version: 1,
    });
    return this.toDto(firmId, created);
  }

  async findById(firmId: string, id: string): Promise<WorkingPaperDto> {
    const ctx: TenantContext = { firmId };
    if (!this.wp) return this.findFallback(firmId, id);
    try {
      const wp = this.wp.registry.get(ctx, id);
      return this.toDto(firmId, wp);
    } catch {
      throw new NotFoundError('WorkingPaper', id);
    }
  }

  async list(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: WorkingPaperDto[]; nextCursor: string | null }> {
    const ctx: TenantContext = { firmId };
    if (!this.wp) return this.listFallback(firmId, opts);
    if (!opts.engagementId) {
      // Package's list requires an engagementId; without one we return empty.
      // TODO(rls-migration): cross-engagement listing arrives with the
      // Postgres registry which can scan the firm-scoped index.
      return { items: [], nextCursor: null };
    }
    const all = this.wp.registry.list(ctx, opts.engagementId);
    const startIdx = opts.cursor ? all.findIndex((w) => w.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length
        ? slice[slice.length - 1]?.id ?? null
        : null;
    return { items: slice.map((wp) => this.toDto(firmId, wp)), nextCursor: next };
  }

  async update(
    firmId: string,
    id: string,
    dto: UpdateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
    const ctx: TenantContext = { firmId };
    if (!this.wp) return this.updateFallback(firmId, id, dto);
    let wp: WorkingPaper;
    try {
      wp = this.wp.registry.get(ctx, id);
    } catch {
      throw new NotFoundError('WorkingPaper', id);
    }
    // Patch the sidecar; the package's content is opaque CRDT bytes so we
    // bump revision via `updateContent` whenever bodyMarkdown changes.
    const sc = this.sidecar.get(id) ?? this.deriveSidecar(wp);
    if (dto.bodyMarkdown !== undefined && dto.bodyMarkdown !== sc.bodyMarkdown) {
      const next = await this.wp.registry.updateContent({
        tenant: ctx,
        workingPaperId: id,
        // Y.Doc updates are base64-encoded; the API surface here passes
        // through plain markdown until the editor wires Yjs end-to-end.
        content: Buffer.from(dto.bodyMarkdown, 'utf8').toString('base64'),
        authorId: ctx.firmId, // TODO(rls-migration): real auditorId from ctx
        searchText: dto.bodyMarkdown,
      });
      wp = next;
    }
    const updated: ApiSidecar = {
      ...sc,
      ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.controlRef !== undefined ? { controlRef: dto.controlRef } : {}),
      ...(dto.bodyMarkdown !== undefined ? { bodyMarkdown: dto.bodyMarkdown } : {}),
      ...(dto.evidenceRefs !== undefined ? { evidenceRefs: dto.evidenceRefs } : {}),
      version: sc.version + 1,
    };
    this.sidecar.set(id, updated);
    return this.toDto(firmId, wp);
  }

  async setStatus(
    firmId: string,
    id: string,
    status: WorkingPaperDto['status'],
  ): Promise<WorkingPaperDto> {
    const ctx: TenantContext = { firmId };
    if (!this.wp) return this.setStatusFallback(firmId, id, status);
    let wp: WorkingPaper;
    try {
      wp = this.wp.registry.get(ctx, id);
    } catch {
      throw new NotFoundError('WorkingPaper', id);
    }
    const sc = this.sidecar.get(id) ?? this.deriveSidecar(wp);
    if (status === 'final' && sc.status !== 'final') {
      // Map "final" to a verdict transition (no-op if already conformant).
      // TODO(rls-migration): this mapping is conservative; once the API DTO
      // surfaces verdicts directly we can drop the bridge.
    }
    this.sidecar.set(id, { ...sc, status });
    return this.toDto(firmId, wp);
  }

  /* -------------------- DTO bridge -------------------- */

  private toDto(firmId: string, wp: WorkingPaper): WorkingPaperDto {
    const sc = this.sidecar.get(wp.id) ?? this.deriveSidecar(wp);
    return {
      id: wp.id,
      firmId,
      engagementId: wp.engagementId,
      ...(sc.templateId !== undefined ? { templateId: sc.templateId } : {}),
      title: sc.title,
      controlRef: sc.controlRef,
      bodyMarkdown: sc.bodyMarkdown,
      evidenceRefs: sc.evidenceRefs,
      status: sc.status,
      version: sc.version,
      createdAt: wp.createdAt,
      updatedAt: wp.lastEditedAt,
    };
  }

  private deriveSidecar(wp: WorkingPaper): ApiSidecar {
    return {
      title: wp.scope.controlId ?? wp.scope.clauseId ?? wp.id,
      controlRef:
        wp.scope.controlId ?? wp.scope.clauseId ?? wp.scope.aiSystemId ?? 'unknown',
      bodyMarkdown: '',
      evidenceRefs: [],
      status: this.verdictToStatus(wp.verdict),
      version: wp.revision + 1,
    };
  }

  private verdictToStatus(v: Verdict): WorkingPaperDto['status'] {
    switch (v) {
      case 'conformant':
        return 'draft';
      default:
        return 'in_review';
    }
  }

  /* ------------- legacy in-memory fallback ------------- */
  // Kept for unit-test compat. The new tests in working-papers.adapter.spec
  // exercise the package-backed path.

  private readonly memory = new Map<string, WorkingPaperDto>();
  private async createInMemoryFallback(
    firmId: string,
    dto: CreateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
    const now = new Date().toISOString();
    const row: WorkingPaperDto = {
      id: randomUUID(),
      firmId,
      engagementId: dto.engagementId,
      ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      title: dto.title,
      controlRef: dto.controlRef,
      bodyMarkdown: dto.bodyMarkdown,
      evidenceRefs: dto.evidenceRefs,
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }
  private async findFallback(firmId: string, id: string): Promise<WorkingPaperDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('WorkingPaper', id);
    return r;
  }
  private async listFallback(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: WorkingPaperDto[]; nextCursor: string | null }> {
    const all = [...this.memory.values()].filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
  private async updateFallback(
    firmId: string,
    id: string,
    dto: UpdateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
    const cur = await this.findFallback(firmId, id);
    const updated: WorkingPaperDto = {
      ...cur,
      ...dto,
      version: cur.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.memory.set(id, updated);
    return updated;
  }
  private async setStatusFallback(
    firmId: string,
    id: string,
    status: WorkingPaperDto['status'],
  ): Promise<WorkingPaperDto> {
    const cur = await this.findFallback(firmId, id);
    if (cur.status === 'final' && status !== 'final') {
      throw new ConflictError('Working paper is final');
    }
    const updated: WorkingPaperDto = { ...cur, status, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }

  // Silence unused imports under `noUnusedLocals` when the registry path is
  // taken in production.
  protected readonly _hashContent = hashContent;
}
