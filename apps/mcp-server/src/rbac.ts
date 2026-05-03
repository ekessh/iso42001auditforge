// SPDX-License-Identifier: BUSL-1.1
/**
 * Per-tool RBAC matrix. Single source of truth used by the dispatcher.
 *
 * Matches the v2 role system. Adding a new tool MUST also add an entry here
 * (dispatcher fails closed if a tool isn't in the matrix).
 */

import type { AuditorRole, Principal, EngagementId } from './types.js';

export interface ToolPolicy {
  readonly allowedRoles: readonly AuditorRole[];
  /**
   * If true, the principal must additionally be provisioned against the
   * engagement passed to the tool. Tools without an `engagementId` parameter
   * (e.g. `list_engagements`) set this to false.
   */
  readonly requiresEngagementMembership: boolean;
}

export const TOOL_POLICIES: Readonly<Record<string, ToolPolicy>> = Object.freeze({
  list_engagements: {
    allowedRoles: ['lead_auditor', 'firm_admin'],
    requiresEngagementMembership: false,
  },
  get_engagement: {
    // "Anyone with engagement access" — every auditor role; membership check
    // is the gate. We exclude `auditee` because they go through the
    // separate Auditee Portal (per v2).
    allowedRoles: [
      'lead_auditor',
      'team_auditor',
      'peer_reviewer',
      'audit_manager',
      'firm_admin',
      'technical_expert',
    ],
    requiresEngagementMembership: true,
  },
  list_findings: {
    allowedRoles: ['lead_auditor', 'team_auditor', 'peer_reviewer'],
    requiresEngagementMembership: true,
  },
  get_candidate_findings: {
    allowedRoles: ['lead_auditor'],
    requiresEngagementMembership: true,
  },
  get_coverage_state: {
    allowedRoles: ['lead_auditor', 'audit_manager'],
    requiresEngagementMembership: true,
  },
  draft_followup_question: {
    allowedRoles: ['lead_auditor'],
    requiresEngagementMembership: true,
  },
  summarize_engagement: {
    allowedRoles: ['lead_auditor', 'firm_admin'],
    requiresEngagementMembership: true,
  },
  search_claims: {
    allowedRoles: ['lead_auditor', 'technical_expert'],
    requiresEngagementMembership: true,
  },
});

export interface AuthorizationResult {
  readonly allowed: boolean;
  readonly reason: string | null;
  readonly errorCode: string | null;
}

const ALLOW: AuthorizationResult = Object.freeze({
  allowed: true,
  reason: null,
  errorCode: null,
});

function deny(reason: string, errorCode: string): AuthorizationResult {
  return { allowed: false, reason, errorCode };
}

/**
 * Authorize a tool invocation. Fail-closed:
 * 1. Tool must be in the policy matrix.
 * 2. Principal must hold one of the allowed roles.
 * 3. If membership is required, principal must be provisioned against the
 *    engagement.
 *
 * Cross-tenant attempts (firm boundary) are caught by step 3 because
 * `engagements[]` on the Principal is firm-scoped at token-issue time.
 */
export function authorizeTool(
  toolName: string,
  principal: Principal,
  engagementId: EngagementId | null,
): AuthorizationResult {
  const policy = TOOL_POLICIES[toolName];
  if (!policy) {
    return deny(`unknown tool: ${toolName}`, 'mcp.unknown_tool');
  }
  const hasRole = principal.roles.some((r) => policy.allowedRoles.includes(r));
  if (!hasRole) {
    return deny(
      `role(s) [${principal.roles.join(',')}] not permitted for ${toolName}`,
      'mcp.rbac.forbidden',
    );
  }
  if (policy.requiresEngagementMembership) {
    if (!engagementId) {
      return deny('engagementId required by policy but not supplied', 'mcp.rbac.missing_engagement');
    }
    if (!principal.engagements.includes(engagementId)) {
      return deny(
        'principal not provisioned against engagement',
        'mcp.rbac.cross_tenant',
      );
    }
  }
  return ALLOW;
}

export function isToolKnown(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(TOOL_POLICIES, name);
}

export function listKnownTools(): readonly string[] {
  return Object.keys(TOOL_POLICIES);
}
