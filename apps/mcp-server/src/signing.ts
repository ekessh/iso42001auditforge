// SPDX-License-Identifier: BUSL-1.1
/**
 * Ed25519-signed receipt support for MCP tool invocations that mutate state.
 *
 * Currently only `report.publish` produces a receipt. Receipts are emitted to
 * the audit ledger and surfaced to the caller. The signer is supplied by the
 * server bootstrap (`apps/mcp-server/bin/auditforge-mcp.js`) so unit tests can
 * substitute an in-memory implementation.
 */

import type { SigningProvider } from '@auditforge/signing';
import { canonicalize } from '@auditforge/signing';

export interface ReceiptPayload {
  readonly tool: string;
  readonly engagementId: string;
  readonly auditorId: string;
  readonly reportId: string;
  readonly publishedAt: string;
}

export interface SignedReceipt {
  readonly keyId: string;
  readonly algorithm: 'Ed25519';
  readonly signatureBase64: string;
  readonly canonicalPayloadBase64: string;
}

export interface McpReceiptSigner {
  sign(payload: ReceiptPayload): Promise<SignedReceipt>;
}

export class SoftwareReceiptSigner implements McpReceiptSigner {
  private readonly provider: SigningProvider;
  private readonly keyId: string;

  constructor(provider: SigningProvider, keyId: string) {
    this.provider = provider;
    this.keyId = keyId;
  }

  async sign(payload: ReceiptPayload): Promise<SignedReceipt> {
    const canonical = canonicalize(payload as unknown as Record<string, unknown>);
    const bytes = new TextEncoder().encode(canonical);
    const sig = await this.provider.sign(bytes);
    return {
      keyId: this.keyId,
      algorithm: 'Ed25519',
      signatureBase64: Buffer.from(sig).toString('base64'),
      canonicalPayloadBase64: Buffer.from(bytes).toString('base64'),
    };
  }
}
