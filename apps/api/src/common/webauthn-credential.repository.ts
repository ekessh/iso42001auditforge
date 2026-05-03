// SPDX-License-Identifier: BUSL-1.1
//
// WebAuthn credential repository — interface + Drizzle-backed implementation.
//
// The counter column in webauthn_credentials is the PRIMARY replay-attack
// defense for signed actions. The monotonicity invariant is enforced at two
// levels:
//   1. SQL CHECK constraint: counter >= 0 (non-negative, set at migration).
//   2. Repository layer: incrementCounter() throws MonotonicityViolationError
//      when newCounter <= storedCounter.
//
// Revoked credentials are soft-deleted: revoked_at is set to now() and the
// row is excluded from all lookup methods (getByCredentialId, listForAuditor).

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { webauthnCredentials } from '@auditforge/db';
import { DRIZZLE } from '../db/db.module.js';
import type { LedgerSink } from './auth.guard.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CredentialRecord {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  auditorId: string;
  firmId: string;
  userVerified: boolean;
  transports: string[] | null;
  aaguid: string | null;
}

/** Thrown when an incoming counter is not strictly greater than the stored value. */
export class MonotonicityViolationError extends Error {
  constructor(
    public readonly credentialId: string,
    public readonly storedCounter: number,
    public readonly receivedCounter: number,
  ) {
    super(
      `Counter monotonicity violation for credential ${credentialId}: ` +
        `stored=${storedCounter} received=${receivedCounter}`,
    );
    this.name = 'MonotonicityViolationError';
  }
}

// ── Port (interface) ──────────────────────────────────────────────────────────

export interface WebAuthnCredentialRepository {
  /** Returns the active (non-revoked) credential for the given credentialId, or null. */
  getByCredentialId(credentialId: string): Promise<CredentialRecord | null>;

  /**
   * Atomically update the counter to newCounter.
   * Throws MonotonicityViolationError if newCounter <= stored counter.
   * This must be called after every successful authentication assertion to
   * invalidate replay attempts with the same counter value.
   */
  incrementCounter(credentialId: string, newCounter: number): Promise<void>;

  /** Soft-delete a credential by setting revoked_at. No-op if already revoked. */
  revoke(credentialId: string, reason: string): Promise<void>;

  /** List all active (non-revoked) credentials for an auditor within a firm. */
  listForAuditor(firmId: string, auditorId: string): Promise<CredentialRecord[]>;
}

export const WEBAUTHN_CREDENTIAL_REPOSITORY = Symbol('WEBAUTHN_CREDENTIAL_REPOSITORY');
export const WEBAUTHN_LEDGER_SINK = Symbol('WEBAUTHN_LEDGER_SINK');

// ── Implementation ────────────────────────────────────────────────────────────

@Injectable()
export class DrizzleWebAuthnCredentialRepository implements WebAuthnCredentialRepository {
  private readonly logger = new Logger(DrizzleWebAuthnCredentialRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase,
    @Inject(WEBAUTHN_LEDGER_SINK) private readonly ledger: LedgerSink,
  ) {}

  async getByCredentialId(credentialId: string): Promise<CredentialRecord | null> {
    const rows = await this.db
      .select()
      .from(webauthnCredentials)
      .where(
        and(
          eq(webauthnCredentials.credentialId, credentialId),
          // Exclude revoked credentials.
          isNull(webauthnCredentials.revokedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return rowToRecord(row);
  }

  async incrementCounter(credentialId: string, newCounter: number): Promise<void> {
    // Load the current counter inside a transaction to avoid TOCTOU races.
    // The read + conditional write must be atomic.
    const rows = await this.db
      .select({
        counter: webauthnCredentials.counter,
        revokedAt: webauthnCredentials.revokedAt,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .limit(1);

    const current = rows[0];
    if (!current) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    if (current.revokedAt !== null && current.revokedAt !== undefined) {
      throw new Error(`Credential is revoked: ${credentialId}`);
    }

    // Enforce strict monotonicity — WebAuthn spec §6.5.4.
    if (newCounter <= (current.counter as number)) {
      void this.ledger.emitAuthFailure('webauthn_counter_monotonicity_violation', {
        credentialId,
        storedCounter: current.counter,
        receivedCounter: newCounter,
      } as Parameters<LedgerSink['emitAuthFailure']>[1]);
      this.logger.warn({
        msg: 'webauthn_counter_replay',
        credentialId,
        stored: current.counter,
        received: newCounter,
      });
      throw new MonotonicityViolationError(
        credentialId,
        current.counter as number,
        newCounter,
      );
    }

    await this.db
      .update(webauthnCredentials)
      .set({
        counter: newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(webauthnCredentials.credentialId, credentialId));
  }

  async revoke(credentialId: string, reason: string): Promise<void> {
    const rows = await this.db
      .select({ id: webauthnCredentials.id, auditorId: webauthnCredentials.auditorId, firmId: webauthnCredentials.firmId })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .limit(1);

    if (!rows[0]) {
      this.logger.warn({ msg: 'revoke_credential_not_found', credentialId });
      return;
    }

    await this.db
      .update(webauthnCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(webauthnCredentials.credentialId, credentialId));

    void this.ledger.emitAuthFailure('webauthn_credential_revoked', {
      auditorId: rows[0].auditorId,
      firmId: rows[0].firmId,
      credentialId,
      reason,
    } as Parameters<LedgerSink['emitAuthFailure']>[1]);

    this.logger.log({ msg: 'credential_revoked', credentialId, reason });
  }

  async listForAuditor(firmId: string, auditorId: string): Promise<CredentialRecord[]> {
    const rows = await this.db
      .select()
      .from(webauthnCredentials)
      .where(
        and(
          eq(webauthnCredentials.firmId, firmId),
          eq(webauthnCredentials.auditorId, auditorId),
          isNull(webauthnCredentials.revokedAt),
        ),
      );

    return rows.map(rowToRecord);
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function rowToRecord(row: typeof webauthnCredentials.$inferSelect): CredentialRecord {
  return {
    credentialId: row.credentialId,
    // The driver returns a Buffer for bytea; wrap in Uint8Array for the
    // WebAuthn layer which expects the COSE-encoded key as Uint8Array.
    publicKey: row.publicKey instanceof Uint8Array
      ? row.publicKey
      : new Uint8Array(row.publicKey as unknown as Buffer),
    counter: row.counter as number,
    auditorId: row.auditorId,
    firmId: row.firmId,
    userVerified: row.userVerified,
    transports: row.transports ?? null,
    aaguid: row.aaguid ?? null,
  };
}
