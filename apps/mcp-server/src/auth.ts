// SPDX-License-Identifier: BUSL-1.1
/**
 * OAuth-integrated auth gateway. Per the 2026 MCP roadmap: no static secrets,
 * tokens validated against the auditor's IdP via JWKs.
 *
 * This module exposes a port (`AuthGateway`) plus two implementations:
 *   - `JwksAuthGateway` — production. Verifies access tokens against an IdP's
 *     JWKs, extracts roles + engagement membership claims.
 *   - `StaticPrincipalAuthGateway` — test-only. Maps opaque token strings to
 *     pre-registered principals. NEVER use in production; the constructor
 *     accepts an explicit `_testOnly: true` flag to make this loud.
 *
 * The actual JWKs HTTP fetch + crypto live in the integration layer
 * (`apps/api`); this server stays transport-agnostic and accepts an injected
 * `verifyJwt` function.
 */

import type { Principal, AuditorRole } from './types.js';
import { AUDITOR_ROLES } from './types.js';

export class AuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

export interface AuthGateway {
  /**
   * Verify an `Authorization: Bearer <token>` header value and return the
   * Principal. Throws `AuthError` on any failure (expired, invalid signature,
   * insufficient claims). Server treats AuthError as 401.
   */
  verify(authorizationHeader: string | null | undefined): Promise<Principal>;
}

/** Minimal JWT claim shape we expect on access tokens issued for MCP. */
export interface ExpectedClaims {
  readonly sub: string;
  readonly aud: string | readonly string[];
  readonly iss: string;
  readonly exp: number;
  readonly nbf?: number;
  readonly jti?: string;
  readonly auditforge_firm_id: string;
  readonly auditforge_auditor_id: string;
  readonly auditforge_roles: readonly string[];
  readonly auditforge_engagements: readonly string[];
}

/** Pure JWT verification port. Implementations call jose / openid-client. */
export type JwtVerifier = (
  token: string,
) => Promise<ExpectedClaims>;

export interface JwksAuthGatewayOpts {
  readonly verifyJwt: JwtVerifier;
  readonly expectedAudience: string;
  readonly expectedIssuer: string;
  /** Clock skew allowance in seconds. Default 30. */
  readonly clockSkewSec?: number;
  readonly now?: () => number;
}

const BEARER_RE = /^Bearer\s+([A-Za-z0-9._\-+/=]+)$/;

function asBearer(header: string | null | undefined): string {
  if (!header) {
    throw new AuthError('mcp.auth.missing_authorization', 'authorization header missing');
  }
  const m = BEARER_RE.exec(header);
  if (!m || !m[1]) {
    throw new AuthError(
      'mcp.auth.malformed_authorization',
      'authorization header malformed; expected "Bearer <token>"',
    );
  }
  return m[1];
}

function asAudienceMatch(aud: string | readonly string[], expected: string): boolean {
  if (typeof aud === 'string') return aud === expected;
  return aud.includes(expected);
}

function filterRoles(raw: readonly string[]): readonly AuditorRole[] {
  const out: AuditorRole[] = [];
  for (const r of raw) {
    if ((AUDITOR_ROLES as readonly string[]).includes(r)) {
      out.push(r as AuditorRole);
    }
  }
  return out;
}

export class JwksAuthGateway implements AuthGateway {
  private readonly verifyJwt: JwtVerifier;
  private readonly expectedAudience: string;
  private readonly expectedIssuer: string;
  private readonly clockSkewSec: number;
  private readonly now: () => number;

  constructor(opts: JwksAuthGatewayOpts) {
    this.verifyJwt = opts.verifyJwt;
    this.expectedAudience = opts.expectedAudience;
    this.expectedIssuer = opts.expectedIssuer;
    this.clockSkewSec = opts.clockSkewSec ?? 30;
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async verify(authorizationHeader: string | null | undefined): Promise<Principal> {
    const token = asBearer(authorizationHeader);
    let claims: ExpectedClaims;
    try {
      claims = await this.verifyJwt(token);
    } catch (err) {
      throw new AuthError(
        'mcp.auth.invalid_signature',
        `token verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (claims.iss !== this.expectedIssuer) {
      throw new AuthError('mcp.auth.bad_issuer', `unexpected issuer: ${claims.iss}`);
    }
    if (!asAudienceMatch(claims.aud, this.expectedAudience)) {
      throw new AuthError('mcp.auth.bad_audience', `aud mismatch`);
    }
    const now = this.now();
    if (claims.exp + this.clockSkewSec < now) {
      throw new AuthError('mcp.auth.expired', 'token expired');
    }
    if (claims.nbf !== undefined && claims.nbf > now + this.clockSkewSec) {
      throw new AuthError('mcp.auth.not_yet_valid', 'token nbf in future');
    }
    if (!claims.auditforge_firm_id || !claims.auditforge_auditor_id) {
      throw new AuthError('mcp.auth.insufficient_claims', 'missing firm/auditor claims');
    }
    const roles = filterRoles(claims.auditforge_roles ?? []);
    if (roles.length === 0) {
      throw new AuthError('mcp.auth.no_roles', 'principal has no audit roles');
    }
    return Object.freeze({
      auditorId: claims.auditforge_auditor_id,
      firmId: claims.auditforge_firm_id,
      roles,
      engagements: Object.freeze(claims.auditforge_engagements ?? []),
      sub: claims.sub,
      tokenId: claims.jti ?? '',
    });
  }
}

/**
 * Test-only gateway. Maps opaque tokens to principals. Does NOT verify any
 * signature. The `_testOnly` flag is mandatory and the class name is loud on
 * purpose so this can't sneak into production.
 */
export class StaticPrincipalAuthGateway implements AuthGateway {
  private readonly map: Map<string, Principal>;
  constructor(entries: Iterable<[string, Principal]>, opts: { readonly _testOnly: true }) {
    if (!opts._testOnly) {
      throw new Error('StaticPrincipalAuthGateway: _testOnly must be true');
    }
    this.map = new Map(entries);
  }

  async verify(authorizationHeader: string | null | undefined): Promise<Principal> {
    const token = asBearer(authorizationHeader);
    const p = this.map.get(token);
    if (!p) {
      throw new AuthError('mcp.auth.unknown_token', 'unknown test token');
    }
    return p;
  }
}
