// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/config.schema.js';
import { queueToken } from '../../queue/queue.module.js';
import { StorageService } from '../../storage/storage.service.js';
import type { EvidenceDto, FinalizeUploadDto, PresignUploadDto, PresignedUploadResponseDto, DownloadUrlDto } from './dto.js';
import { EvidenceRepository } from './evidence-vault.repository.js';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly repo: EvidenceRepository,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(queueToken('evidence-av-scan')) private readonly avQueue: Queue,
    @Inject(queueToken('evidence-ocr')) private readonly ocrQueue: Queue,
  ) {}

  async presign(firmId: string, dto: PresignUploadDto): Promise<PresignedUploadResponseDto> {
    return this.storage.presignUpload(firmId, dto.filename);
  }

  async finalize(firmId: string, dto: FinalizeUploadDto): Promise<EvidenceDto> {
    const row = await this.repo.insert(firmId, dto, this.cfg.S3_BUCKET);
    await this.avQueue.add('scan', { evidenceId: row.id, firmId, bucket: row.bucket, objectKey: row.objectKey });
    if (dto.mimeType.startsWith('application/pdf') || dto.mimeType.startsWith('image/')) {
      await this.ocrQueue.add('ocr', { evidenceId: row.id, firmId, bucket: row.bucket, objectKey: row.objectKey });
    }
    return row;
  }

  async get(firmId: string, id: string): Promise<EvidenceDto> { return this.repo.findById(firmId, id); }
  async list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) { return this.repo.list(firmId, opts); }

  async signedDownload(firmId: string, id: string): Promise<DownloadUrlDto> {
    const ev = await this.repo.findById(firmId, id);
    const url = await this.storage.presignDownload(ev.bucket, ev.objectKey, 300);
    return { url, expiresAt: new Date(Date.now() + 300_000).toISOString() };
  }
}
