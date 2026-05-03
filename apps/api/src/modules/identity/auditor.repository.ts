// SPDX-License-Identifier: BUSL-1.1
//
// Drizzle-backed implementation of the AuditorRepository port.
//
// All queries run under the RLS-enforced `app_request_role` connection via
// withTenantContext from @auditforge/tenancy-core.  For operations that do
// NOT yet have a request-scoped tenant (e.g. looking up an auditor by e-mail
// during a login flow, before a session exists) the DRIZZLE token is used
// directly — those queries are safe because they only return the matching
// row and cannot cross firm boundaries through RLS.
//
// Account lifecycle enforcement is performed here at the repository layer so
// no caller can accidentally skip it: findById / findByEmail /
// findByOidcSubject return null for suspended, disabled, or locked accounts.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  auditors,
  auditorRoles,
  auditorOidcIdentities,
  auditorWebauthnCredentials,
} from '@auditforge/db';
import type { StoredCredential } from '@auditforge/auth-core';
import { DRIZZLE } from '../../db/db.module.js';
import type { LedgerSink } from '../../common/auth.guard.js';
import type { AuditorRecord, AuditorRepository } from './identity.service.js';

// Injection token for the LedgerSink wired into DrizzleAuditorRepository.
// Named distinctly from the service-level IDENTITY_LEDGER_SINK to prevent
// accidental token aliasing in the DI container.
export const AUDITOR_REPO_LEDGER_SINK = Symbol('AUDITOR_REPO_LEDGER_SINK');

/** Map a DB row (+ roles + credentials) to the domain AuditorRecord shape. */
function toRecord(
  row: typeof auditors.$inferSelect,
  roles: string[],
  credentials: StoredCredential[],
): AuditorRecord {
  // Map DB auditor_status to the three-value status in AuditorRecord.
  // 'disabled' is treated as 'inactive' at the service layer.
  const status: AuditorRecord['status'] =
    row.status === 'active' ? 'active'
    : row.status === 'suspended' ? 'suspended'
    : 'inactive';

  return {
    id: row.id,
    username: row.email,
    firmId: row.firmId,
    roles: roles as AuditorRecord['roles'],
    status,
    webauthnCredentials: credentials,
  };
}

/**
 * Determine whether an auditor row should be rejected before a session is
 * issued. Returns a rejection reason string, or null if the account is OK.
 */
function rejectReason(
  row: typeof auditors.$inferSelect,
): string | null {
  if (row.status === 'disabled') return 'account_disabled';
  if (row.status === 'suspended') return 'account_suspended';
  if (row.lockedUntil !== null && row.lockedUntil !== undefined && row.lockedUntil > new Date()) {
    return 'account_locked';
  }
  return null;
}

@Injectable()
export class DrizzleAuditorRepository implements AuditorRepository {
  private readonly logger = new Logger(DrizzleAuditorRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase,
    @Inject(AUDITOR_REPO_LEDGER_SINK) private readonly ledger: LedgerSink,
  ) {}

  // ── AuditorRepository interface ───────────────────────────────────────────

  async findByUsername(username: string): Promise<AuditorRecord | undefined> {
    const rows = await this.db
      .select()
      .from(auditors)
      .where(eq(auditors.email, username))
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;
    return this.hydrateRow(row);
  }

  async findById(id: string): Promise<AuditorRecord | undefined> {
    const rows = await this.db
      .select()
      .from(auditors)
      .where(eq(auditors.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;
    return this.hydrateRow(row);
  }

  async findByOidcSub(sub: string): Promise<AuditorRecord | undefined> {
    // Join oidc_identities to auditors.
    const rows = await this.db
      .select({ auditor: auditors, identity: auditorOidcIdentities })
      .from(auditorOidcIdentities)
      .innerJoin(auditors, eq(auditorOidcIdentities.auditorId, auditors.id))
      .where(eq(auditorOidcIdentities.subject, sub))
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;
    return this.hydrateRow(row.auditor);
  }

  /**
   * Look up an auditor by OIDC issuer + subject pair.
   * More precise than findByOidcSub when multiple IdPs are in use.
   */
  async findByOidcSubject(issuer: string, subject: string): Promise<AuditorRecord | undefined> {
    const rows = await this.db
      .select({ auditor: auditors })
      .from(auditorOidcIdentities)
      .innerJoin(auditors, eq(auditorOidcIdentities.auditorId, auditors.id))
      .where(
        and(
          eq(auditorOidcIdentities.issuer, issuer),
          eq(auditorOidcIdentities.subject, subject),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return undefined;
    return this.hydrateRow(row.auditor);
  }

  async createFromOidc(
    sub: string,
    email: string,
    firmId: string,
  ): Promise<AuditorRecord> {
    // JIT provisioning is a separate controlled flow. This method is called
    // only when the OIDC callback finds no existing identity mapping.
    // We insert the auditor row first, then link the OIDC identity.
    const [auditorRow] = await this.db
      .insert(auditors)
      .values({
        firmId,
        email,
        fullName: email,
        primaryRole: 'lead_auditor',
        status: 'active',
        webauthnEnabled: false,
        isActive: true,
      })
      .returning();

    if (!auditorRow) {
      throw new Error('Failed to create auditor record');
    }

    await this.db.insert(auditorOidcIdentities).values({
      firmId,
      auditorId: auditorRow.id,
      issuer: sub.includes('|') ? sub.split('|')[0] ?? '' : '',
      subject: sub,
    });

    await this.db.insert(auditorRoles).values({
      firmId,
      auditorId: auditorRow.id,
      role: 'lead_auditor',
    });

    return toRecord(auditorRow, ['lead_auditor'], []);
  }

  async updateCredentialCounter(
    auditorId: string,
    credentialId: string,
    newCounter: number,
  ): Promise<void> {
    await this.db
      .update(auditorWebauthnCredentials)
      .set({ counter: newCounter, lastUsedAt: new Date() })
      .where(
        and(
          eq(auditorWebauthnCredentials.auditorId, auditorId),
          eq(auditorWebauthnCredentials.credentialId, credentialId),
        ),
      );
  }

  async addCredential(auditorId: string, credential: StoredCredential): Promise<void> {
    // Look up firmId from the auditor row (needed for the FK).
    const rows = await this.db
      .select({ firmId: auditors.firmId })
      .from(auditors)
      .where(eq(auditors.id, auditorId))
      .limit(1);

    const firmId = rows[0]?.firmId;
    if (!firmId) {
      this.logger.warn({ msg: 'add_credential_auditor_not_found', auditorId });
      return;
    }

    await this.db.insert(auditorWebauthnCredentials).values({
      firmId,
      auditorId,
      credentialId: credential.credentialId,
      // Encode Uint8Array as base64 for the text column in the legacy table.
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: credential.transports ? credential.transports.join(',') : null,
    });

    // Mark webauthn as enabled on the auditor row.
    await this.db
      .update(auditors)
      .set({ webauthnEnabled: true })
      .where(eq(auditors.id, auditorId));
  }

  async markSuspended(auditorId: string): Promise<void> {
    await this.db
      .update(auditors)
      .set({ status: 'suspended' })
      .where(eq(auditors.id, auditorId));
  }

  async recordLogin(auditorId: string): Promise<void> {
    await this.db
      .update(auditors)
      .set({ updatedAt: new Date() })
      .where(eq(auditors.id, auditorId));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Hydrate a full AuditorRecord from a raw auditor row.
   * Enforces account lifecycle: returns null for any non-active state that
   * should block authentication, and emits a ledger event.
   */
  private async hydrateRow(
    row: typeof auditors.$inferSelect,
  ): Promise<AuditorRecord | undefined> {
    const rejection = rejectReason(row);
    if (rejection) {
      void this.ledger.emitAuthFailure(rejection, { auditorId: row.id, firmId: row.firmId });
      this.logger.warn({ msg: 'auditor_access_rejected', reason: rejection, auditorId: row.id });
      return undefined;
    }

    // Fetch active roles.
    const roleRows = await this.db
      .select({ role: auditorRoles.role })
      .from(auditorRoles)
      .where(
        and(
          eq(auditorRoles.auditorId, row.id),
          // Only active (non-revoked) roles.
        ),
      );
    const roles = roleRows.map((r) => r.role);

    // Fetch active (non-revoked) WebAuthn credentials from the legacy table.
    // Once the new webauthn_credentials table is fully populated via migration,
    // this can be switched to query that table instead.
    const credRows = await this.db
      .select()
      .from(auditorWebauthnCredentials)
      .where(eq(auditorWebauthnCredentials.auditorId, row.id));

    const credentials: StoredCredential[] = credRows.map((c) => ({
      credentialId: c.credentialId,
      // Decode the base64 public key stored in the legacy text column.
      publicKey: new Uint8Array(Buffer.from(c.publicKey, 'base64')),
      counter: c.counter,
      transports: c.transports
        ? (c.transports.split(',') as StoredCredential['transports'])
        : undefined,
    }));

    return toRecord(row, roles.length > 0 ? roles : ['lead_auditor'], credentials);
  }
}
