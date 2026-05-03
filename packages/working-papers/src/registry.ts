// SPDX-License-Identifier: BUSL-1.1
import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictError,
  NotFoundError,
  TenantViolation,
  ValidationError,
  type TenantContext,
} from '@auditforge/shared';
import type { SearchIndexer } from './search.js';
import { toSearchDoc } from './search.js';
import {
  WorkingPaperSchema,
  WpEvidenceLinkSchema,
  WpObservationSchema,
  type Verdict,
  type WorkingPaper,
  type WpEvidenceLink,
  type WpEvidenceLinkTarget,
  type WpObservation,
  type WpScope,
} from './domain.js';
import { applyVerdictTransition } from './verdict.js';
import { nowIso, noopWpLedger, type WpLedgerEmitter } from './ledger.js';

export interface CreateWorkingPaperInput {
  tenant: TenantContext;
  engagementId: string;
  scope: WpScope;
  templateId: string;
  templateVersion: string;
  initialContent: string; // base64-encoded Y update
  authorId: string;
  initialVerdict?: Verdict | undefined;
  initialConfidence?: number | undefined;
}

export interface UpdateContentInput {
  tenant: TenantContext;
  workingPaperId: string;
  content: string;
  authorId: string;
  /**
   * Optional rendered plaintext for search indexing. Callers (the API) should
   * pass the editor's serialized text; if absent the registry indexes an empty
   * doc which is still safe but yields no hits.
   */
  searchText?: string;
}

export interface ChangeVerdictInput {
  tenant: TenantContext;
  workingPaperId: string;
  to: Verdict;
  reason?: string | undefined;
  authorId: string;
}

export interface ChangeConfidenceInput {
  tenant: TenantContext;
  workingPaperId: string;
  confidence: number;
  authorId: string;
}

export interface AddEvidenceLinkInput {
  tenant: TenantContext;
  workingPaperId: string;
  target: WpEvidenceLinkTarget;
  note?: string | undefined;
  authorId: string;
}

export interface AddObservationInput {
  tenant: TenantContext;
  workingPaperId: string;
  text: string;
  severity: 'info' | 'minor' | 'major';
  authorId: string;
  evidenceLinkIds?: readonly string[];
}

export interface WorkingPaperRegistryOptions {
  emit?: WpLedgerEmitter;
  search?: SearchIndexer;
  /** Override id generator (tests). Default: `crypto.randomUUID`. */
  idGen?: () => string;
  /** Override clock. */
  now?: () => string;
}

/**
 * In-memory registry. Persistence is delegated upstream — apps/api wraps this
 * in a Postgres-backed adapter. The registry's job is to enforce tenancy +
 * state-machine invariants and to emit ledger events on every mutation.
 */
export class WorkingPaperRegistry {
  private readonly papers = new Map<string, WorkingPaper>();
  private readonly observations = new Map<string, WpObservation[]>();
  private readonly evidenceLinks = new Map<string, WpEvidenceLink[]>();

  private readonly emit: WpLedgerEmitter;
  private readonly search: SearchIndexer | undefined;
  private readonly idGen: () => string;
  private readonly now: () => string;

  constructor(opts: WorkingPaperRegistryOptions = {}) {
    this.emit = opts.emit ?? noopWpLedger;
    this.search = opts.search;
    this.idGen = opts.idGen ?? (() => randomUUID());
    this.now = opts.now ?? nowIso;
  }

  /* ---- CRUD ---- */

  async create(input: CreateWorkingPaperInput): Promise<WorkingPaper> {
    const id = this.idGen();
    const at = this.now();
    const wp: WorkingPaper = WorkingPaperSchema.parse({
      id,
      firmId: input.tenant.firmId,
      engagementId: input.engagementId,
      scope: input.scope,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      content: input.initialContent,
      contentHash: hashContent(input.initialContent),
      verdict: input.initialVerdict ?? 'conformant',
      confidence: input.initialConfidence ?? 0,
      authorId: input.authorId,
      lastEditedAt: at,
      revision: 0,
      createdAt: at,
    });

    this.papers.set(id, wp);
    this.observations.set(id, []);
    this.evidenceLinks.set(id, []);

    await this.emit({
      type: 'wp.created',
      tenant: input.tenant,
      workingPaperId: id,
      templateId: input.templateId,
      authorId: input.authorId,
      at,
    });

    if (this.search) {
      await this.search.upsert(toSearchDoc(wp, ''));
    }

    return wp;
  }

  get(tenant: TenantContext, workingPaperId: string): WorkingPaper {
    const wp = this.papers.get(workingPaperId);
    if (!wp) throw new NotFoundError('WorkingPaper', workingPaperId);
    this.assertTenant(tenant, wp);
    return wp;
  }

  list(tenant: TenantContext, engagementId: string): WorkingPaper[] {
    return [...this.papers.values()].filter(
      (wp) =>
        wp.firmId === tenant.firmId && wp.engagementId === engagementId,
    );
  }

  async updateContent(input: UpdateContentInput): Promise<WorkingPaper> {
    const existing = this.get(input.tenant, input.workingPaperId);
    const at = this.now();
    const next: WorkingPaper = {
      ...existing,
      content: input.content,
      contentHash: hashContent(input.content),
      authorId: input.authorId,
      lastEditedAt: at,
      revision: existing.revision + 1,
    };
    this.papers.set(next.id, next);

    await this.emit({
      type: 'wp.updated',
      tenant: input.tenant,
      workingPaperId: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
      authorId: input.authorId,
      at,
    });

    if (this.search) {
      await this.search.upsert(toSearchDoc(next, input.searchText ?? ''));
    }
    return next;
  }

  async changeVerdict(input: ChangeVerdictInput): Promise<WorkingPaper> {
    const existing = this.get(input.tenant, input.workingPaperId);
    const transition = applyVerdictTransition({
      from: existing.verdict,
      to: input.to,
      reason: input.reason,
    });
    const at = this.now();
    const next: WorkingPaper = {
      ...existing,
      verdict: transition.to,
      lastEditedAt: at,
      revision: existing.revision + 1,
      authorId: input.authorId,
    };
    this.papers.set(next.id, next);

    await this.emit({
      type: 'wp.verdict_changed',
      tenant: input.tenant,
      workingPaperId: next.id,
      from: transition.from,
      to: transition.to,
      reason: transition.reason,
      authorId: input.authorId,
      at,
    });

    if (this.search) {
      await this.search.upsert(toSearchDoc(next, ''));
    }
    return next;
  }

  async changeConfidence(input: ChangeConfidenceInput): Promise<WorkingPaper> {
    if (
      !Number.isInteger(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 100
    ) {
      throw new ValidationError('confidence must be an integer in [0,100]', {
        confidence: input.confidence,
      });
    }
    const existing = this.get(input.tenant, input.workingPaperId);
    const at = this.now();
    const next: WorkingPaper = {
      ...existing,
      confidence: input.confidence,
      lastEditedAt: at,
      revision: existing.revision + 1,
      authorId: input.authorId,
    };
    this.papers.set(next.id, next);

    await this.emit({
      type: 'wp.updated',
      tenant: input.tenant,
      workingPaperId: next.id,
      revision: next.revision,
      contentHash: next.contentHash,
      authorId: input.authorId,
      at,
    });
    return next;
  }

  async delete(
    tenant: TenantContext,
    workingPaperId: string,
    authorId: string,
  ): Promise<void> {
    const wp = this.get(tenant, workingPaperId);
    this.papers.delete(wp.id);
    this.observations.delete(wp.id);
    this.evidenceLinks.delete(wp.id);
    await this.emit({
      type: 'wp.deleted',
      tenant,
      workingPaperId: wp.id,
      authorId,
      at: this.now(),
    });
    if (this.search) {
      await this.search.remove(wp.id);
    }
  }

  /* ---- Sub-collections ---- */

  async addEvidenceLink(input: AddEvidenceLinkInput): Promise<WpEvidenceLink> {
    const wp = this.get(input.tenant, input.workingPaperId);
    const at = this.now();
    const link: WpEvidenceLink = WpEvidenceLinkSchema.parse({
      id: this.idGen(),
      workingPaperId: wp.id,
      target: input.target,
      note: input.note,
      addedAt: at,
      addedBy: input.authorId,
    });
    const links = this.evidenceLinks.get(wp.id) ?? [];
    links.push(link);
    this.evidenceLinks.set(wp.id, links);

    await this.emit({
      type: 'wp.evidence_linked',
      tenant: input.tenant,
      workingPaperId: wp.id,
      linkId: link.id,
      kind: link.target.kind,
      authorId: input.authorId,
      at,
    });

    return link;
  }

  listEvidenceLinks(
    tenant: TenantContext,
    workingPaperId: string,
  ): WpEvidenceLink[] {
    const wp = this.get(tenant, workingPaperId);
    return [...(this.evidenceLinks.get(wp.id) ?? [])];
  }

  async addObservation(input: AddObservationInput): Promise<WpObservation> {
    const wp = this.get(input.tenant, input.workingPaperId);
    const at = this.now();
    const obs: WpObservation = WpObservationSchema.parse({
      id: this.idGen(),
      workingPaperId: wp.id,
      text: input.text,
      severity: input.severity,
      authorId: input.authorId,
      createdAt: at,
      evidenceLinkIds: [...(input.evidenceLinkIds ?? [])],
    });
    const list = this.observations.get(wp.id) ?? [];
    list.push(obs);
    this.observations.set(wp.id, list);

    await this.emit({
      type: 'wp.observation_added',
      tenant: input.tenant,
      workingPaperId: wp.id,
      observationId: obs.id,
      severity: obs.severity,
      authorId: input.authorId,
      at,
    });

    return obs;
  }

  listObservations(
    tenant: TenantContext,
    workingPaperId: string,
  ): WpObservation[] {
    const wp = this.get(tenant, workingPaperId);
    return [...(this.observations.get(wp.id) ?? [])];
  }

  /* ---- Tenancy guard ---- */

  private assertTenant(tenant: TenantContext, wp: WorkingPaper): void {
    if (wp.firmId !== tenant.firmId) {
      throw new TenantViolation(
        'Working paper belongs to a different firm',
        { firmId: tenant.firmId, wpFirmId: wp.firmId, workingPaperId: wp.id },
      );
    }
    if (
      tenant.engagementId !== undefined &&
      tenant.engagementId !== wp.engagementId
    ) {
      throw new TenantViolation(
        'Working paper belongs to a different engagement',
        {
          engagementId: tenant.engagementId,
          wpEngagementId: wp.engagementId,
          workingPaperId: wp.id,
        },
      );
    }
  }
}

/** Convenience: SHA-256 hex over the encoded content string. */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** Re-export for convenience. */
export { ConflictError };
