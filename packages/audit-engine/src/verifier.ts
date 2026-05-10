// SPDX-License-Identifier: BUSL-1.1

import { canonicalJsonStringify, computeChainHash, GENESIS_HASH, sha256Hex } from './hash.js';
import type {
  EventQuery,
  EventRepository,
  LedgerEvent,
  VerifyResult,
} from './ledger.js';
import type { TsaProvider } from './tsa.js';

export interface SignatureVerifier {
  verify(
    canonicalEnvelope: Uint8Array,
    signatureBase64: string,
    publicKeyBase64: string,
  ): Promise<boolean>;
}

export interface ChainVerifyOptions {
  readonly verifySignatures?: boolean;
  readonly verifyTsa?: boolean;
}

export class ChainVerifier {
  constructor(
    private readonly repo: EventRepository,
    private readonly options: {
      signatureVerifier?: SignatureVerifier;
      tsa?: TsaProvider;
    } = {},
  ) {}

  async verify(query: EventQuery, opts: ChainVerifyOptions = {}): Promise<VerifyResult> {
    const events = await this.repo.list({ ...query });
    let prevHash = GENESIS_HASH;
    let prevSeq = 0;
    for (const e of events) {
      if (e.prevHash !== prevHash) {
        return fail(events.length, e.sequenceNumber, `prevHash mismatch at sequence ${e.sequenceNumber}`);
      }
      if (e.sequenceNumber !== prevSeq + 1) {
        return fail(events.length, e.sequenceNumber, `non-monotonic sequence at ${e.sequenceNumber}`);
      }
      const canonicalPayload = canonicalJsonStringify(e.payload);
      const metadata = canonicalJsonStringify({
        id: e.id,
        firmId: e.firmId,
        auditorId: e.auditorId,
        engagementId: e.engagementId,
        sequenceNumber: e.sequenceNumber,
        eventType: e.eventType,
        schemaVersion: e.schemaVersion,
        producer: e.producer,
        occurredAt: e.occurredAt,
      });
      const expectedHash = computeChainHash(prevHash, canonicalPayload, metadata);
      if (expectedHash !== e.chainHash) {
        return fail(events.length, e.sequenceNumber, `chainHash mismatch at sequence ${e.sequenceNumber}`);
      }
      if (opts.verifySignatures === true && this.options.signatureVerifier !== undefined) {
        const signed = (e as LedgerEvent & {
          signature?: string;
          signerPublicKeyBase64?: string;
        });
        if (signed.signature !== undefined && signed.signerPublicKeyBase64 !== undefined) {
          const envelope = new TextEncoder().encode(canonicalPayload + '|' + metadata);
          const ok = await this.options.signatureVerifier.verify(
            envelope,
            signed.signature,
            signed.signerPublicKeyBase64,
          );
          if (!ok) {
            return fail(events.length, e.sequenceNumber, `signature mismatch at sequence ${e.sequenceNumber}`);
          }
        }
      }
      if (opts.verifyTsa === true && this.options.tsa !== undefined && e.tsaToken !== null) {
        const digest = sha256Hex(canonicalPayload, '|', metadata);
        const ok = await this.options.tsa.verify(digest, e.tsaToken);
        if (!ok) {
          return fail(events.length, e.sequenceNumber, `TSA token invalid at sequence ${e.sequenceNumber}`);
        }
      }
      prevHash = e.chainHash;
      prevSeq = e.sequenceNumber;
    }
    return { valid: true, checkedCount: events.length };
  }
}

function fail(checked: number, seq: number, reason: string): VerifyResult {
  return { valid: false, checkedCount: checked, firstInvalidSequence: seq, reason };
}
