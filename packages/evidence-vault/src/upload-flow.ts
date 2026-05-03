// SPDX-License-Identifier: BUSL-1.1
import { validateFilename, safeFilename, tenantPrefix } from './filename-safety.js';
import type { ObjectStoreAdapter, AvScannerAdapter, LedgerEmitter } from './adapters.js';
import type { EvidenceObject } from './domain.js';
import type { EvidenceRegistry, TenantContext } from './registry.js';

export interface PresignRequest {
  filename: string;
  mimeType: string;
  size: number;
  sha256: string;
  sha3_256: string;
}

export interface PresignResult {
  uploadId: string;
  url: string;
  headers: Record<string, string>;
  storageKey: string;
}

const MAX_SIZE = 5 * 1024 * 1024 * 1024;

export class UploadFlow {
  constructor(
    private readonly store: ObjectStoreAdapter,
    private readonly av: AvScannerAdapter,
    private readonly ledger: LedgerEmitter,
    private readonly registry: EvidenceRegistry,
    private readonly retentionDays = 365 * 10,
  ) {}

  async presign(ctx: TenantContext, evidenceId: string, req: PresignRequest): Promise<PresignResult> {
    const v = validateFilename(req.filename);
    if (!v.ok) throw new Error(`unsafe filename: ${v.reason}`);
    if (req.size > MAX_SIZE) throw new Error('file too large');
    const safe = safeFilename(req.filename);
    const storageKey = `${tenantPrefix(ctx.firmId, ctx.engagementId, evidenceId)}/${safe}`;
    const presigned = await this.store.presignPut(storageKey, {
      contentType: req.mimeType,
      contentLength: req.size,
      sha256: req.sha256,
      ttlSeconds: 600,
    });
    return { uploadId: evidenceId, url: presigned.url, headers: presigned.headers, storageKey };
  }

  async complete(ctx: TenantContext, evidenceId: string, req: PresignRequest, storageKey: string, uploadedBy: string): Promise<EvidenceObject> {
    const head = await this.store.head(storageKey);
    if (!head) throw new Error('object missing');
    if (head.size !== req.size) throw new Error('size mismatch');
    if (head.sha256 && head.sha256 !== req.sha256) throw new Error('hash mismatch');

    const now = new Date();
    const retainUntil = new Date(now.getTime() + this.retentionDays * 24 * 3600 * 1000).toISOString();

    const obj: EvidenceObject = {
      id: evidenceId,
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      filename: req.filename,
      mimeType: req.mimeType,
      size: req.size,
      sha256: req.sha256,
      sha3_256: req.sha3_256,
      storageKey,
      avScanResult: 'pending',
      ocrText: null,
      uploadedBy,
      uploadedAt: now.toISOString(),
      retainUntil,
    };
    await this.registry.create(ctx, obj);
    await this.ledger.emit('evidence.uploaded', {
      evidenceId, firmId: ctx.firmId, engagementId: ctx.engagementId,
      sha256: req.sha256, size: req.size, uploadedBy,
    });
    return obj;
  }
}
