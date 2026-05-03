// SPDX-License-Identifier: BUSL-1.1
import type { EvidenceObject, EvidenceLink } from './domain.js';

export interface TenantContext {
  firmId: string;
  auditorId: string;
  engagementId: string;
}

export interface EvidenceRepository {
  insert(obj: EvidenceObject): Promise<void>;
  findById(ctx: TenantContext, id: string): Promise<EvidenceObject | null>;
  listByEngagement(ctx: TenantContext): Promise<EvidenceObject[]>;
  insertLink(link: EvidenceLink): Promise<void>;
  listLinks(ctx: TenantContext, evidenceId: string): Promise<EvidenceLink[]>;
  delete(ctx: TenantContext, id: string): Promise<void>;
}

export class EvidenceRegistry {
  constructor(private readonly repo: EvidenceRepository) {}

  async create(ctx: TenantContext, obj: EvidenceObject): Promise<EvidenceObject> {
    if (obj.firmId !== ctx.firmId) throw new Error('tenant violation');
    if (obj.engagementId !== ctx.engagementId) throw new Error('engagement scope violation');
    await this.repo.insert(obj);
    return obj;
  }

  async link(ctx: TenantContext, link: EvidenceLink): Promise<void> {
    const evidence = await this.repo.findById(ctx, link.evidenceId);
    if (!evidence) throw new Error('evidence not found in tenant scope');
    await this.repo.insertLink(link);
  }

  async list(ctx: TenantContext): Promise<EvidenceObject[]> {
    return this.repo.listByEngagement(ctx);
  }
}
