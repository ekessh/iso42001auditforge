// SPDX-License-Identifier: BUSL-1.1
/**
 * Thin wrapper around @auditforge/auth-core's canonical RBAC matrix.
 *
 * All wildcard (*) entries from the previous local matrix have been removed.
 * Role, Action, and Resource enums are re-exported directly from the package
 * so every consumer (RbacGuard, controllers, tests) uses a single source of
 * truth.
 *
 * Migration from the old local matrix:
 *   - `auditor` → `team_auditor`
 *   - `observer` → `client_user` (read-only) or `peer_reviewer`
 *   - `accreditation_inspector` → `accreditation_auditor`
 *   - `service` role removed — service-to-service authentication must use
 *     short-lived JWTs with explicit resource grants, not a wildcard role.
 */

import {
  can as coreCan,
  canScope as coreCanScope,
  buildFullPermissionMatrix as coreBuildMatrix,
  permissionScope as corePermissionScope,
  ROLES,
  RESOURCES,
  ACTIONS,
  type Role,
  type Action,
  type Resource,
  type Permission,
} from '@auditforge/auth-core';

// Re-export plain type-only and constant re-exports.
export {
  ROLES,
  RESOURCES,
  ACTIONS,
  type Role,
  type Action,
  type Resource,
  type Permission,
};

// Re-export the matrix constant so existing consumers that referenced
// RBAC_MATRIX have a named symbol to import (even though they should
// prefer the can() / canScope() functions for runtime checks).
export const RBAC_MATRIX = coreBuildMatrix();

// Re-export the scope-level helpers unchanged.
export const canScope = coreCanScope;
export const permissionScope = corePermissionScope;
export const buildFullPermissionMatrix = coreBuildMatrix;

/**
 * Compatibility shim: the old adapter's `can(roles[], resource, action)`
 * accepted an array of roles. This wrapper preserves that call-site signature
 * so RbacGuard does not need to change its public API.
 *
 * Internally it delegates to `can(role, action, resource)` from auth-core
 * which has a different parameter order — note the intentional swap.
 *
 * Unknown resource strings always return false — no wildcard fallthrough.
 */
export function can(roles: readonly Role[], resource: Resource | string, action: Action): boolean {
  for (const role of roles) {
    if (coreCan(role, action, resource as Resource)) return true;
  }
  return false;
}
