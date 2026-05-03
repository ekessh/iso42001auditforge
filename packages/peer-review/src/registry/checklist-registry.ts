// SPDX-License-Identifier: BUSL-1.1
import {
  ConflictError,
  ImmutableViolation,
  NotFoundError,
  TenantViolation,
  ValidationError,
  type TenantContext,
} from '@auditforge/shared';
import {
  PeerReviewChecklistSchema,
  type PeerReviewChecklist,
  type PeerReviewChecklistInput,
  type QualityChecklistItem,
} from '../domain/checklist.js';
import type { AuditKind } from '../domain/enums.js';

/**
 * In-memory registry of peer-review checklists. Persistence is the caller's
 * concern; this is the canonical CRUD + customization logic.
 *
 * Storage key: `${firmId ?? 'global'}::${id}::${version}`. Listing by
 * `(firmId, auditKind)` returns the highest-version published checklist
 * applicable: firm-specific override beats global.
 */
export class ChecklistRegistry {
  private readonly byKey = new Map<string, PeerReviewChecklist>();

  /** Idempotent insert. Re-publishing the same id+version is a `ConflictError`. */
  publish(template: PeerReviewChecklistInput): PeerReviewChecklist {
    const parsed = PeerReviewChecklistSchema.parse(template);
    assertItemIdsUnique(parsed.items);
    const key = makeKey(parsed.firmId, parsed.id, parsed.version);
    if (this.byKey.has(key)) {
      throw new ConflictError(
        `Checklist already published: ${parsed.id}@${parsed.version}`,
        { id: parsed.id, version: parsed.version, firmId: parsed.firmId },
      );
    }
    if (parsed.customizationOf) {
      const baseKey = makeKey(undefined, parsed.customizationOf.id, parsed.customizationOf.version);
      const base = this.byKey.get(baseKey);
      if (!base) {
        throw new NotFoundError(
          'Base template',
          `${parsed.customizationOf.id}@${parsed.customizationOf.version}`,
        );
      }
      if (base.appliesTo !== parsed.appliesTo) {
        throw new ValidationError(
          'Customization must target same auditKind as base',
          { base: base.appliesTo, custom: parsed.appliesTo },
        );
      }
    }
    this.byKey.set(key, parsed);
    return parsed;
  }

  /**
   * Customize an existing global template for a specific firm. Cloned items
   * may add/remove/modify items but must preserve item-id uniqueness.
   */
  customize(args: {
    baseId: string;
    baseVersion: string;
    firmId: string;
    newVersion: string;
    items: readonly QualityChecklistItem[];
    publishedAt: string;
    title?: string;
    description?: string;
    notes?: string;
  }): PeerReviewChecklist {
    const baseKey = makeKey(undefined, args.baseId, args.baseVersion);
    const base = this.byKey.get(baseKey);
    if (!base) {
      throw new NotFoundError('Base template', `${args.baseId}@${args.baseVersion}`);
    }
    const input: PeerReviewChecklistInput = {
      id: base.id,
      version: args.newVersion,
      title: args.title ?? base.title,
      description: args.description ?? base.description,
      appliesTo: base.appliesTo,
      firmId: args.firmId,
      customizationOf: { id: args.baseId, version: args.baseVersion },
      items: args.items as QualityChecklistItem[],
      publishedAt: args.publishedAt,
      frozen: true,
    };
    return this.publish(input);
  }

  get(
    id: string,
    version: string,
    tenant?: TenantContext,
  ): PeerReviewChecklist {
    // Firm-specific first.
    if (tenant?.firmId) {
      const firmKey = makeKey(tenant.firmId, id, version);
      const firmTpl = this.byKey.get(firmKey);
      if (firmTpl) return firmTpl;
    }
    const globalKey = makeKey(undefined, id, version);
    const tpl = this.byKey.get(globalKey);
    if (!tpl) throw new NotFoundError('Checklist', `${id}@${version}`);
    return tpl;
  }

  /**
   * Resolve the best-applicable checklist for a tenant + audit kind. Picks
   * the highest semver among:
   *   - firm-scoped customizations (firmId match), then
   *   - global defaults (firmId undefined).
   * Firm beats global at any version. Returns undefined if none applies.
   */
  resolve(tenant: TenantContext, auditKind: AuditKind): PeerReviewChecklist | undefined {
    const firmCandidates: PeerReviewChecklist[] = [];
    const globalCandidates: PeerReviewChecklist[] = [];
    for (const tpl of this.byKey.values()) {
      if (tpl.appliesTo !== auditKind) continue;
      if (tpl.firmId === tenant.firmId) firmCandidates.push(tpl);
      else if (!tpl.firmId) globalCandidates.push(tpl);
    }
    const pool = firmCandidates.length > 0 ? firmCandidates : globalCandidates;
    if (pool.length === 0) return undefined;
    return pool.sort((a, b) => semverCompare(b.version, a.version))[0];
  }

  list(filters?: {
    firmId?: string;
    auditKind?: AuditKind;
  }): readonly PeerReviewChecklist[] {
    let out = Array.from(this.byKey.values());
    if (filters?.firmId !== undefined) {
      const f = filters.firmId;
      out = out.filter((t) => t.firmId === f);
    }
    if (filters?.auditKind) {
      out = out.filter((t) => t.appliesTo === filters.auditKind);
    }
    return Object.freeze(out);
  }

  /**
   * Templates are frozen by default. This method exists only to surface the
   * frozen-flag contract to callers; mutation is rejected.
   */
  attemptEdit(id: string, version: string): never {
    throw new ImmutableViolation(
      `Checklist ${id}@${version} is frozen — publish a new version instead`,
      { id, version },
    );
  }

  /** Tenant-scoped lookup used by workflow services. Throws `TenantViolation`
   * if the resolved template is firm-scoped to a different firm. */
  getForTenant(
    id: string,
    version: string,
    tenant: TenantContext,
  ): PeerReviewChecklist {
    const tpl = this.get(id, version, tenant);
    if (tpl.firmId && tpl.firmId !== tenant.firmId) {
      throw new TenantViolation('Checklist belongs to another firm', {
        firmId: tpl.firmId,
        callerFirmId: tenant.firmId,
      });
    }
    return tpl;
  }
}

function makeKey(firmId: string | undefined, id: string, version: string): string {
  return `${firmId ?? 'global'}::${id}::${version}`;
}

function assertItemIdsUnique(items: readonly QualityChecklistItem[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new ValidationError(`Duplicate item id in checklist: ${item.id}`, {
        itemId: item.id,
      });
    }
    seen.add(item.id);
  }
}

/** Internal semver comparator (major.minor.patch only; ignores prerelease). */
export function semverCompare(a: string, b: string): number {
  const pa = a.split('-')[0]?.split('.').map((x) => Number.parseInt(x, 10)) ?? [];
  const pb = b.split('-')[0]?.split('.').map((x) => Number.parseInt(x, 10)) ?? [];
  for (let i = 0; i < 3; i += 1) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
