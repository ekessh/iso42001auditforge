// SPDX-License-Identifier: BUSL-1.1
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { auditors } from './auditors.js';
import { auditFirms } from './firms.js';
import { createdAt, firmIdColumn, idColumn } from './_shared.js';

// bytea column — Drizzle does not ship a first-class bytea helper so we
// declare it with customType. The driver returns a Buffer; we type it as
// Uint8Array for portability with the WebAuthn layer.
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Uint8Array): Buffer {
    return Buffer.from(value);
  },
  fromDriver(value: Buffer): Uint8Array {
    return new Uint8Array(value);
  },
});

export const webauthnCredentials = pgTable(
  'webauthn_credentials',
  {
    id: idColumn(),
    firmId: firmIdColumn().references(() => auditFirms.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => auditors.id, { onDelete: 'cascade' }),
    // Raw base64url credential ID from the WebAuthn assertion / attestation.
    credentialId: text('credential_id').notNull().unique(),
    // COSE-encoded public key returned by the authenticator at registration.
    publicKey: bytea('public_key').notNull(),
    // Monotonically-increasing signature counter. Replay guard: any assertion
    // with counter <= stored value MUST be rejected. Bigint to avoid integer
    // overflow on high-frequency authenticators.
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    // Authenticator transport hints (usb | nfc | ble | internal | hybrid).
    transports: text('transports').array(),
    // Authenticator Attestation GUID — identifies the authenticator model.
    aaguid: uuid('aaguid'),
    // True when the assertion was verified with user-verification (UV bit set).
    userVerified: boolean('user_verified').notNull().default(false),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    // Soft-delete: set when credential is revoked. Non-null = revoked.
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    ixFirmAuditor: index('webauthn_credentials_firm_auditor_ix').on(t.firmId, t.auditorId),
    uqCredentialId: uniqueIndex('webauthn_credentials_credential_id_uq').on(t.credentialId),
  }),
);

export type WebAuthnCredentialRow = typeof webauthnCredentials.$inferSelect;
export type NewWebAuthnCredential = typeof webauthnCredentials.$inferInsert;
