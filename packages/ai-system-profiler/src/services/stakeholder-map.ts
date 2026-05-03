// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { ValidationError, err, ok, type Result } from '../compat/shared.js';
import {
  AiSystemStakeholderSchema,
  type AiSystemStakeholder,
  type StakeholderMap,
  type StakeholderRole,
} from '../types/stakeholder.js';
import type { AiSystem } from '../types/ai-system.js';
import { isAgentKind, isPlatformKind } from '../types/kinds.js';

/**
 * Required RACI roles for ISO 42001 Annex A.3 (organisational roles for
 * AI). Used by the StakeholderMapBuilder to surface gaps.
 */
const REQUIRED_ROLES: readonly StakeholderRole[] = [
  'business_owner',
  'compliance',
  'risk_owner',
];

/** Additional roles for agentic systems (HITL design § 3.6). */
const REQUIRED_FOR_AGENT: readonly StakeholderRole[] = ['human_reviewer'];

/** Additional roles for platforms (multi-tenant ops). */
const REQUIRED_FOR_PLATFORM: readonly StakeholderRole[] = ['mlops', 'security_officer'];

export interface StakeholderInput {
  role: StakeholderRole;
  displayName: string;
  email?: string;
  department?: string;
  responsibilities?: readonly string[];
  isPrimaryAccountable?: boolean;
}

/**
 * StakeholderMapBuilder — assembles a normalised stakeholder map for an
 * AI system, surfacing role-coverage gaps required by ISO 42001 A.3 and
 * the AuditForge stakeholder schema (design § 3.3).
 */
export class StakeholderMapBuilder {
  private readonly newId: () => string;
  private readonly now: () => string;
  constructor(deps: { newId?: () => string; now?: () => string } = {}) {
    this.newId = deps.newId ?? randomUUID;
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  /**
   * Build a {@link StakeholderMap} for a system + raw inputs. Returns
   * a Result so callers can present validation errors uniformly.
   */
  build(
    system: AiSystem,
    rawStakeholders: readonly StakeholderInput[],
  ): Result<{ map: StakeholderMap; missingRoles: readonly StakeholderRole[] }, ValidationError> {
    const stakeholders: AiSystemStakeholder[] = [];
    for (const s of rawStakeholders) {
      const candidate = {
        id: this.newId(),
        aiSystemId: system.id,
        role: s.role,
        displayName: s.displayName,
        ...(s.email !== undefined ? { email: s.email } : {}),
        ...(s.department !== undefined ? { department: s.department } : {}),
        responsibilities: [...(s.responsibilities ?? [])],
        isPrimaryAccountable: s.isPrimaryAccountable ?? false,
      };
      const parsed = AiSystemStakeholderSchema.safeParse(candidate);
      if (!parsed.success) {
        return err(
          new ValidationError(`invalid stakeholder: ${s.displayName}`, {
            issues: parsed.error.issues,
          }),
        );
      }
      stakeholders.push(parsed.data);
    }

    const primaries = stakeholders.filter((s) => s.isPrimaryAccountable);
    if (primaries.length > 1) {
      return err(
        new ValidationError(
          `at most one primary accountable stakeholder is allowed (got ${primaries.length})`,
        ),
      );
    }

    const required = new Set<StakeholderRole>(REQUIRED_ROLES);
    if (isAgentKind(system.kind)) for (const r of REQUIRED_FOR_AGENT) required.add(r);
    if (isPlatformKind(system.kind)) for (const r of REQUIRED_FOR_PLATFORM) required.add(r);

    const present = new Set<StakeholderRole>(stakeholders.map((s) => s.role));
    const missing: StakeholderRole[] = [];
    for (const r of required) if (!present.has(r)) missing.push(r);

    const map: StakeholderMap = {
      aiSystemId: system.id,
      stakeholders,
      generatedAt: this.now(),
    };
    return ok({ map, missingRoles: missing });
  }
}
