// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors

import { createHash, randomBytes } from "node:crypto";

/**
 * Deterministic WebAuthn passkey simulator for e2e and integration tests.
 * Not a real cryptographic authenticator — produces structurally-valid
 * fixture data so the auth pipeline can run end-to-end without a real
 * security key.
 */
export class WebAuthnSimulator {
  private readonly registry = new Map<string, { credId: string; publicKey: string }>();

  enroll(email: string): { credId: string; publicKey: string } {
    const credId = `cred_${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
    const publicKey = `pk_${createHash("sha256").update(email).digest("hex").slice(0, 48)}`;
    this.registry.set(email, { credId, publicKey });
    return { credId, publicKey };
  }

  attest(email: string, challenge: string): { credId: string; signature: string } {
    const cred = this.registry.get(email);
    if (!cred) throw new Error(`unenrolled: ${email}`);
    const signature = createHash("sha256").update(`${cred.credId}|${challenge}`).digest("hex");
    return { credId: cred.credId, signature };
  }

  static generateChallenge(): string {
    return randomBytes(32).toString("base64url");
  }

  isEnrolled(email: string): boolean {
    return this.registry.has(email);
  }

  reset(): void {
    this.registry.clear();
  }
}
