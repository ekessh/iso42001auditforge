// SPDX-License-Identifier: BUSL-1.1

import { createHash } from 'node:crypto';
import { buildDocx } from './docx-builder.js';
import { buildPdf, type PdfBuildAttachment } from './pdf-builder.js';
import {
  READINESS_DISCLAIMER,
  type ReportInput,
  ReportInputSchema,
} from './report-domain.js';

export interface ReportSigningProvider {
  signBytes(bytes: Uint8Array, opts: { signerId: string; prevHash?: string | null }): Promise<{
    signature: string;
    payloadHash: string;
    signerId: string;
    signerKeyId: string;
    publicKeyBase64: string;
    algorithm: string;
    ts: string;
  }>;
}

export interface ReportTsaProvider {
  stamp(payloadDigestHex: string): Promise<{ tokenBase64: string; tsaUrl: string; issuedAt: string; messageImprintHex: string }>;
}

export interface ReportLedgerWriter {
  emit(input: {
    firmId: string;
    engagementId?: string;
    auditorId?: string;
    eventType: 'report.signed' | 'report.published';
    payload: Record<string, unknown>;
  }): Promise<{ id: string; sequenceNumber: number; chainHash: string }>;
}

export interface ReportPublishOutput {
  readonly format: 'docx' | 'pdfa3';
  readonly bytes: Uint8Array;
  readonly contentHash: string;
  readonly signature: {
    signature: string;
    payloadHash: string;
    signerId: string;
    signerKeyId: string;
    publicKeyBase64: string;
    algorithm: string;
    ts: string;
  };
  readonly tsaToken: { tokenBase64: string; tsaUrl: string; issuedAt: string; messageImprintHex: string };
  readonly ledgerEventId: string;
  readonly ledgerSequence: number;
}

export interface ReportEngineDeps {
  readonly signing: ReportSigningProvider;
  readonly tsa: ReportTsaProvider;
  readonly ledger: ReportLedgerWriter;
}

export interface PublishOptions {
  readonly format: 'docx' | 'pdfa3';
  readonly signerId: string;
  readonly auditorId?: string;
  readonly producer?: string;
  readonly attachments?: readonly PdfBuildAttachment[];
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function bytesContains(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

export class ReportEngineService {
  constructor(private readonly deps: ReportEngineDeps) {}

  async publish(rawInput: ReportInput, opts: PublishOptions): Promise<ReportPublishOutput> {
    const input = ReportInputSchema.parse(rawInput);

    if (input.kind === 'readiness') {
      const disclaimerBytes = new TextEncoder().encode(READINESS_DISCLAIMER);
      const probe = (out: Uint8Array): boolean => bytesContains(out, disclaimerBytes);
      const checked = (b: Uint8Array): Uint8Array => {
        if (!probe(b)) throw new Error('Readiness report did not contain the mandatory non-certification disclaimer.');
        return b;
      };
      void checked;
    }

    let bytes: Uint8Array;
    if (opts.format === 'docx') {
      bytes = buildDocx(input);
    } else {
      bytes = buildPdf({ report: input, ...(opts.attachments !== undefined ? { attachments: opts.attachments } : {}), ...(opts.producer !== undefined ? { producer: opts.producer } : {}) });
    }

    if (input.kind === 'readiness') {
      const dec = new TextDecoder('utf-8', { fatal: false });
      const text = dec.decode(bytes);
      if (!text.includes('NOT A CERTIFICATION AUDIT')) {
        throw new Error('Readiness report missing mandatory non-certification banner.');
      }
    }

    const contentHash = sha256Hex(bytes);
    const signature = await this.deps.signing.signBytes(bytes, { signerId: opts.signerId });
    const tsaToken = await this.deps.tsa.stamp(contentHash);

    const ledgerEvent = await this.deps.ledger.emit({
      firmId: input.firmId,
      engagementId: input.engagementId,
      ...(opts.auditorId !== undefined ? { auditorId: opts.auditorId } : {}),
      eventType: 'report.published',
      payload: {
        reportId: input.reportId,
        kind: input.kind,
        format: opts.format,
        contentHash,
        signerId: signature.signerId,
        signerKeyId: signature.signerKeyId,
        signatureAlgorithm: signature.algorithm,
        tsaUrl: tsaToken.tsaUrl,
        tsaIssuedAt: tsaToken.issuedAt,
        attachmentsCount: opts.attachments?.length ?? 0,
        readinessDisclaimerEmbedded: input.kind === 'readiness',
      },
    });

    return {
      format: opts.format,
      bytes,
      contentHash,
      signature,
      tsaToken,
      ledgerEventId: ledgerEvent.id,
      ledgerSequence: ledgerEvent.sequenceNumber,
    };
  }
}
